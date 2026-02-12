// src/native/CIE2500Native.ts
import { EventEmitter } from 'node:events';
import type { NomeModelo, Mac, Info, Status, DataHora } from '../types/cie';

// Ajuste os caminhos conforme onde você colocou os fontes da Intelbras
const udpFactory = require('../intelbras/udp.js');
const remoteOpperationFactory = require('../intelbras/remoteOpperation.js');
const remoteConnectionFactory = require('../intelbras/remoteConnection.js');

type Msg = { event: string; data?: any };

function onceWithTimeout<T = any>(em: EventEmitter, event: string, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (data: any) => { cleanup(); resolve(data as T); };
    const to = setTimeout(() => { cleanup(); reject(new Error(`timeout waiting ${event}`)); }, ms);
    const cleanup = () => { clearTimeout(to); em.off(event, handler); };
    em.once(event, handler);
  });
}

function waitAny(
  em: EventEmitter,
  events: string[],
  ms: number
): Promise<{ event: string; data: any }> {
  return new Promise((resolve, reject) => {
    const handlers: Array<[(data: any) => void, string]> = [];
    const done = (payload?: { event: string; data: any }, isTimeout = false) => {
      handlers.forEach(([h, ev]) => em.off(ev, h));
      if (isTimeout) reject(new Error(`timeout waiting ${events.join(' | ')}`));
      else resolve(payload!);
    };
    const to = setTimeout(() => done(undefined, true), ms);
    for (const ev of events) {
      const h = (data: any) => { clearTimeout(to); done({ event: ev, data }); };
      handlers.push([h, ev]);
      em.once(ev, h);
    }
  });
}

export class CIE2500Native extends EventEmitter {
  private udp: any;
  private RemoteOpperation: any;
  private RemoteConnection: any;
  private connected = false;
  private requestTimeoutMs = 10000;

  constructor() {
    super();

    // O udp.js espera uma função "wsSendFunction" — convertemos em eventos do Node
    this.udp = udpFactory((msg: Msg) => {
      try { this.emit(msg.event, msg.data); } catch {}
    });

    // Compatibilidade com código original (connectionController)
    this.udp.setConnectionStatus = (v: boolean) => {
      this.connected = !!v;
      this.emit('conn_status', this.connected);
    };

    this.RemoteOpperation   = remoteOpperationFactory(this.udp);
    this.RemoteConnection   = remoteConnectionFactory(this.udp);
  }

  setRequestTimeoutMs(ms: number) {
    if (Number.isFinite(ms) && ms > 0) this.requestTimeoutMs = ms;
  }

  /** Descobre centrais por multicast/broadcast e sincroniza counters da cifra */
  async discover(getNameMac = false): Promise<any> {
    // o udp.assign aceita boolean ou objeto; manter compatibilidade
    this.udp.assign(getNameMac ? { getNameMac: true } : true);
    try {
      return await onceWithTimeout<any>(this, 'udp_descobrir', 8000);
    } catch {
      // IGMP/Firewall às vezes atrasam — tenta novamente
      this.udp.assign(getNameMac ? { getNameMac: true } : true);
      return onceWithTimeout<any>(this, 'udp_descobrir', 8000);
    }
  }

  /** Autentica e retorna o token (4 bytes) */
  async authenticate(ip: string, password: string, endereco = 0): Promise<Buffer> {
    // não chame bootstrap() aqui — o assign() já abriu sockets e sincronizou contadores
    this.udp.auth({ ip, password, endereco });
    const res = await onceWithTimeout<any>(this, 'udp_autenticacao', this.requestTimeoutMs);
    const tokLike = res?.token;
    const token = Buffer.isBuffer(tokLike)
      ? tokLike
      : (tokLike?.type === 'Buffer' && Array.isArray(tokLike.data))
        ? Buffer.from(tokLike.data)
        : null;
    if (!token) throw new Error('token inválido');
    return token;
  }

  /** Inicia a sessão: seta token e valida comunicação com um pedido real */
  async startCommunication(ip: string, endereco: number, token: Buffer): Promise<void> {
    // seta token e instala os handlers internos no módulo vendor
    this.RemoteOpperation.startCommunication({ ip, endereco, token });

    // espere por qualquer um desses como "ok": alguns firmwares não emitem udp_start_communication
    const ready = waitAny(this, ['udp_nome_e_modelo', 'udp_status'], this.requestTimeoutMs);

    // manda um comando simples (nome/modelo funciona até sem auth)
    this.RemoteOpperation.getNameModel({ ip, endereco });

    await ready;
    this.connected = true;
  }

  async stopCommunication(): Promise<void> {
    try { this.udp.stopCommunication(); } finally { this.connected = false; }
  }

  /** Encerramento completo (limpa handlers e fecha sockets) */
  async shutdown() {
    try { this.udp.stopCommunication(); } catch {}
    try { this.udp.setReceiverRemoteOpperationFn(undefined); } catch {}
    try { this.udp.setReceiverRemoteConnectionFn(undefined); } catch {}
    try { this.udp.socketRemoteOpperation?.close?.(); } catch {}
    try { this.udp.socketRemoteConnection?.close?.(); } catch {}
    try { this.udp.socketMulticast?.close?.(); } catch {}
  }

  // ====== Métodos de leitura (tipados) ======

  async status(ip: string, endereco: number): Promise<Status> {
    this.RemoteOpperation.getStatus({ ip, endereco });
    return onceWithTimeout<Status>(this, 'udp_status', this.requestTimeoutMs);
  }

  async nomeModelo(ip: string, endereco: number): Promise<NomeModelo> {
    this.RemoteOpperation.getNameModel({ ip, endereco });
    return onceWithTimeout<NomeModelo>(this, 'udp_nome_e_modelo', this.requestTimeoutMs);
  }

  async mac(ip: string, endereco: number): Promise<Mac> {
    this.RemoteOpperation.getMac({ ip, endereco });
    return onceWithTimeout<Mac>(this, 'udp_mac', this.requestTimeoutMs);
  }

  async info(ip: string, endereco: number): Promise<Info> {
    this.RemoteOpperation.getInfo({ ip, endereco });
    return onceWithTimeout<Info>(this, 'udp_info', this.requestTimeoutMs);
  }

  async dataHora(ip: string, endereco: number): Promise<DataHora> {
    this.RemoteOpperation.getDateTime({ ip, endereco });
    const raw = await onceWithTimeout<any>(this, 'udp_data_hora', this.requestTimeoutMs);

    // Corrige 'utc' a partir do timestamp (evita 1925)
    const ts = Number(raw?.timestamp);
    const date = isFinite(ts) ? new Date(ts) : new Date();
    const utcISO  = date.toISOString();
    const localBR = date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    return { timestamp: ts, utc: utcISO, local: localBR };
  }

  async getEvent(
    ip: string,
    endereco: number,
    evento: 'alarme' | 'falha' | 'supervisao' | 'bloqueio',
    numero: number
  ): Promise<any> {
    this.RemoteOpperation.getEvent({ ip, endereco, evento, numero });
    return onceWithTimeout<any>(this, `udp_evento#${numero}`, this.requestTimeoutMs);
  }

  async getLog(
    ip: string,
    endereco: number,
    evento: 'alarme' | 'falha' | 'supervisao' | 'operacao',
    numero: number
  ): Promise<any> {
    this.RemoteOpperation.getLog({ ip, endereco, evento, numero });
    return onceWithTimeout<any>(this, `udp_log#${numero}`, this.requestTimeoutMs);
  }

  async sendButtonCommand(
    ip: string,
    endereco: number,
    botao: number,
    parametro: number,
    identificador: number
  ): Promise<any> {
    this.RemoteOpperation.sendButtonCommand({ ip, endereco, botao, parametro, identificador });
    return onceWithTimeout<any>(this, 'udp_enviar_comando', this.requestTimeoutMs);
  }

  // ===== Eventos push (opcionalmente você pode criar "onStatus" tipado) =====
  onEvento(fn: (e: any) => void) { this.on('udp_evento', fn); return () => this.off('udp_evento', fn); }
  onLog(fn: (e: any) => void)    { this.on('udp_log', fn);    return () => this.off('udp_log', fn); }
  onConnectionStatus(fn: (connected: boolean) => void) {
    this.on('conn_status', fn);
    return () => this.off('conn_status', fn);
  }
}
