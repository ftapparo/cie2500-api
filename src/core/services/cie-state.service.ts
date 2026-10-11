import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import type { CieClient } from '../cie-client';
import { ACTIVE_TYPES, type CieLogService } from './cie-log.service';
import { describePanelSituation } from './cie-event-catalog';
import type {
  CieActiveType,
  CieCounters,
  CieHistoricLogType,
  CieLogType,
  CiePanelSituation,
} from '../../types/logs';
import type { CieStateSnapshot } from '../../types/state';

type CieStateServiceOptions = {
  pollMs: number;
  logBackfillLimit: number;
  logSyncMs?: number;
  activeEventsLimit?: number;
};

type StatusCounters = CieCounters;

const HISTORY_TYPES: CieHistoricLogType[] = ['alarme', 'falha', 'supervisao', 'operacao'];
const INITIAL_SYNC_LIMIT = 20;

function getCounters(status: any): StatusCounters {
  return {
    alarme: Number(status?.status?.alarme || 0),
    falha: Number(status?.status?.falha || 0),
    supervisao: Number(status?.status?.supervisao || 0),
    bloqueio: Number(status?.status?.bloqueio || 0),
  };
}

function isBipSilenced(status: any): boolean {
  const leds = status?.leds;
  if (!leds || typeof leds !== 'object') return false;

  const centralSilenciada = (leds as Record<string, unknown>).centralSilenciada;
  const bipSilenciado = (leds as Record<string, unknown>).bipSilenciado;

  return centralSilenciada === true || bipSilenciado === true;
}

export class CieStateService extends EventEmitter {
  private readonly client: CieClient;
  private readonly logService: CieLogService;
  private readonly options: Required<CieStateServiceOptions>;
  private readonly restartWatchdogEnabled: boolean;

  private pollTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private restartRecoveryTimer: NodeJS.Timeout | null = null;
  private restartRecoveryInterval: NodeJS.Timeout | null = null;
  private restartHardTimeoutTimer: NodeJS.Timeout | null = null;
  private warmupPromise: Promise<void> | null = null;
  private backfillInFlight = 0;
  private ensureByType: Partial<Record<CieLogType, Promise<void>>> = {};
  private reconnectInFlight = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private syncHistoryByType: Partial<Record<CieHistoricLogType, Promise<void>>> = {};
  private activeRetryAt: Partial<Record<CieActiveType, number>> = {};

  private snapshot: CieStateSnapshot = {
    connected: false,
    restartingUntil: null,
    nomeModelo: null,
    mac: null,
    info: null,
    dataHora: null,
    status: null,
    lastUpdated: null,
    lastError: null,
    reconnecting: false,
    reconnectAttempt: 0,
  };

  private previousCounters: StatusCounters = { alarme: 0, falha: 0, supervisao: 0, bloqueio: 0 };

  constructor(client: CieClient, logService: CieLogService, options: CieStateServiceOptions) {
    super();
    this.client = client;
    this.logService = logService;
    this.restartWatchdogEnabled = String(process.env.CIE_RESTART_WATCHDOG_ENABLED || 'true').trim().toLowerCase() !== 'false';
    this.options = {
      pollMs: Math.max(1000, options.pollMs),
      logBackfillLimit: Math.max(1, options.logBackfillLimit),
      logSyncMs: Math.max(5000, options.logSyncMs ?? 15000),
      activeEventsLimit: Math.max(1, Math.min(250, options.activeEventsLimit ?? 50)),
    };
  }

  getSnapshot(): CieStateSnapshot {
    return { ...this.snapshot };
  }

  getCounters(): StatusCounters {
    return getCounters(this.snapshot.status);
  }

  /** Situação geral pronta para exibição (alarme > falha > supervisão > bloqueio > normal). */
  getSituation(): CiePanelSituation {
    return describePanelSituation({
      connected: this.snapshot.connected,
      restarting: this.isRestarting(),
      counters: this.snapshot.status ? this.getCounters() : null,
      leds: this.snapshot.status?.leds ?? null,
    });
  }

  private setConnected(connected: boolean) {
    if (this.snapshot.connected === connected) return;
    this.snapshot.connected = connected;
    if (connected) {
      this.snapshot.restartingUntil = null;
    }
    this.emit('connection.status.changed', { connected });
  }

  private hardKillProcess(reason: string) {
    if (!this.restartWatchdogEnabled) {
      console.error(`[CIE] Watchdog desativado. Processo nao sera encerrado: ${reason}`);
      return;
    }

    try {
      console.error(`[CIE] Encerrando processo para recuperacao automatica: ${reason}`);
    } catch {
      // no-op
    }
    const pid = process.pid;
    setTimeout(() => {
      if (process.platform === 'win32') {
        try {
          const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
            detached: true,
            stdio: 'ignore',
          });
          killer.unref();
        } catch {
          // fallback abaixo
        }
        setTimeout(() => {
          process.exit(1);
        }, 300);
        return;
      }

      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        try {
          process.kill(pid, 'SIGTERM');
        } catch {
          process.exit(1);
        }
      }
      setTimeout(() => {
        process.exit(1);
      }, 300);
    }, 100);
  }

  private clearRuntimeStateForRestart() {
    this.logService.reset();
    this.snapshot.nomeModelo = null;
    this.snapshot.mac = null;
    this.snapshot.info = null;
    this.snapshot.dataHora = null;
    this.snapshot.status = null;
    this.snapshot.lastUpdated = null;
    this.snapshot.lastError = null;
    this.previousCounters = { alarme: 0, falha: 0, supervisao: 0, bloqueio: 0 };
    this.ensureByType = {};
    this.syncHistoryByType = {};
    this.activeRetryAt = {};
    this.warmupPromise = null;
    this.backfillInFlight = 0;
  }

  markRestarting(durationMs = 60000) {
    const safeDuration = Math.max(5000, Math.min(300000, Math.floor(durationMs)));
    this.clearRuntimeStateForRestart();
    this.snapshot.restartingUntil = Date.now() + safeDuration;
    this.snapshot.reconnecting = true;
    this.snapshot.reconnectAttempt = 0;
    this.stopPolling();
    this.setConnected(false);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.restartRecoveryInterval) {
      clearInterval(this.restartRecoveryInterval);
      this.restartRecoveryInterval = null;
    }
    if (this.restartRecoveryTimer) {
      clearTimeout(this.restartRecoveryTimer);
    }
    if (this.restartHardTimeoutTimer) {
      clearTimeout(this.restartHardTimeoutTimer);
      this.restartHardTimeoutTimer = null;
    }
    // O comando ja foi enviado com sucesso.
    // Agora derruba sessao local imediatamente e inicia loop agressivo de reconexao.
    void this.forceRestartRecoveryNow();

    this.restartHardTimeoutTimer = setTimeout(() => {
      this.restartHardTimeoutTimer = null;
      if (!this.snapshot.connected) {
        this.snapshot.lastError = 'Falha ao reconectar apos reinicio da central (watchdog de 1 minuto).';
        this.snapshot.reconnecting = false;
        this.snapshot.restartingUntil = null;
        this.emit('cie.status.updated', this.getSnapshot());
        this.hardKillProcess('watchdog de reinicio expirado');
      }
    }, safeDuration + 2000);
    this.emit('cie.status.updated', this.getSnapshot());
  }

  private async forceRestartRecoveryNow() {
    try {
      await this.client.disconnect();
    } catch {
      // segue para tentativa de reconexao mesmo com erro no fechamento
    }

    if (!this.isRestarting()) return;
    this.startRestartRecoveryLoop();
  }

  isRestarting(): boolean {
    const until = Number(this.snapshot.restartingUntil || 0);
    return Number.isFinite(until) && until > Date.now();
  }

  async start() {
    this.client.onLog((log) => {
      const typeMap: Record<number, CieLogType> = {
        0: 'alarme',
        1: 'falha',
        2: 'supervisao',
        3: 'operacao',
      };
      const parsedType = typeMap[Number(log?.tipo_evento)];
      const normalized = this.logService.add(parsedType || 'operacao', log);
      if (normalized) this.emit('cie.log.received', normalized);
    });

    // Respostas de getEvent (eventos ativos) não entram no histórico: são
    // consumidas por refreshActive(), que substitui a lista inteira.

    this.client.onConnectionStatus((connected) => {
      this.setConnected(connected);
      if (!connected) {
        if (!this.isRestarting()) {
          this.triggerReconnect();
        }
      } else {
        if (this.restartRecoveryInterval) {
          clearInterval(this.restartRecoveryInterval);
          this.restartRecoveryInterval = null;
        }
        if (this.restartHardTimeoutTimer) {
          clearTimeout(this.restartHardTimeoutTimer);
          this.restartHardTimeoutTimer = null;
        }
        this.snapshot.lastError = null;
        this.snapshot.reconnecting = false;
        this.snapshot.reconnectAttempt = 0;
        this.startPolling();
      }
    });

    try {
      await this.client.connect();
      const initial = await this.client.readInitial();

      this.snapshot.nomeModelo = initial.nomeModelo;
      this.snapshot.mac = initial.mac;
      this.snapshot.info = initial.info;
      this.snapshot.status = initial.status;
      this.snapshot.dataHora = initial.dataHora;
      this.snapshot.lastError = null;
      this.snapshot.lastUpdated = Date.now();
      this.snapshot.reconnecting = false;
      this.snapshot.reconnectAttempt = 0;
      this.snapshot.restartingUntil = null;
      this.previousCounters = getCounters(initial.status);
      this.setConnected(true);
      this.emit('cie.status.updated', this.getSnapshot());
      this.logService.reset();
      this.warmupPromise = this.warmup()
        .catch(() => {
          // ignore initial backfill failures
        })
        .finally(() => {
          this.warmupPromise = null;
        });
    } catch (error: any) {
      this.snapshot.lastError = this.isRestarting() ? null : (error?.message || String(error));
      this.setConnected(false);
      this.triggerReconnect();
    }

    this.startPolling();
  }

  private startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (this.backfillInFlight > 0) return;
      void this.refreshNow();
    }, this.options.pollMs);
    if (!this.syncTimer) {
      this.syncTimer = setInterval(() => {
        if (this.backfillInFlight > 0 || this.isRestarting() || !this.snapshot.connected) return;
        void this.periodicSync();
      }, this.options.logSyncMs);
    }
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        if (this.isRestarting()) {
          const deadline = Number(this.snapshot.restartingUntil || 0);
          if (Number.isFinite(deadline) && Date.now() >= deadline && !this.snapshot.connected) {
            this.snapshot.lastError = 'Falha ao reconectar apos reinicio da central (heartbeat timeout).';
            this.snapshot.reconnecting = false;
            this.snapshot.restartingUntil = null;
            this.emit('cie.status.updated', this.getSnapshot());
            this.hardKillProcess('heartbeat de reinicio expirado');
          }
        }
      }, 1000);
    }
  }

  private stopPolling() {
    if (!this.pollTimer) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async refreshNow() {
    if (this.isRestarting()) {
      return;
    }
    try {
      const [status, dataHora] = await Promise.all([
        this.client.status(),
        this.client.dataHora(),
      ]);
      this.snapshot.status = status;
      this.snapshot.dataHora = dataHora;
      this.snapshot.lastUpdated = Date.now();
      this.snapshot.lastError = null;
      this.snapshot.reconnecting = false;
      this.snapshot.restartingUntil = null;
      this.setConnected(true);

      const currentCounters = getCounters(status);
      await this.handleCounterChanges(this.previousCounters, currentCounters);
      this.previousCounters = currentCounters;

      if (currentCounters.alarme > 0) {
        this.emit('cie.alarm.triggered', {
          ...this.logService.activeAlarmSnapshot(currentCounters),
          situation: this.getSituation(),
          source: 'CIE2500',
          triggeredAt: new Date().toISOString(),
        });
      }

      if (currentCounters.falha > 0) {
        this.emit('cie.failure.triggered', {
          isTriggered: true,
          source: 'CIE2500',
          triggeredAt: new Date().toISOString(),
          counters: currentCounters,
          bipSilenced: isBipSilenced(status),
          latestFailureLogs: this.logService.latestByType('falha', 20),
          activeFailures: this.logService.active('falha'),
          situation: this.getSituation(),
        });
      }

      this.emit('cie.status.updated', this.getSnapshot());
    } catch (error: any) {
      this.snapshot.lastError = this.isRestarting() ? null : (error?.message || String(error));
      this.setConnected(false);
      this.triggerReconnect();
    }
  }

  async reconnectNow() {
    if (this.reconnectInFlight) return;
    this.reconnectInFlight = true;
    this.snapshot.reconnecting = true;
    this.snapshot.reconnectAttempt += 1;
    try {
      await this.client.reconnect();
      const initial = await this.client.readInitial();
      this.snapshot.nomeModelo = initial.nomeModelo;
      this.snapshot.mac = initial.mac;
      this.snapshot.info = initial.info;
      this.snapshot.status = initial.status;
      this.snapshot.dataHora = initial.dataHora;
      this.snapshot.lastError = null;
      this.snapshot.lastUpdated = Date.now();
      this.snapshot.reconnecting = false;
      this.snapshot.reconnectAttempt = 0;
      this.snapshot.restartingUntil = null;
      if (this.restartRecoveryInterval) {
        clearInterval(this.restartRecoveryInterval);
        this.restartRecoveryInterval = null;
      }
      if (this.restartHardTimeoutTimer) {
        clearTimeout(this.restartHardTimeoutTimer);
        this.restartHardTimeoutTimer = null;
      }
      this.startPolling();
      this.previousCounters = getCounters(initial.status);
      this.setConnected(true);
      this.emit('cie.status.updated', this.getSnapshot());
      this.logService.reset();
      this.warmupPromise = this.warmup()
        .catch(() => {
          // ignore reconnect backfill failures
        })
        .finally(() => {
          this.warmupPromise = null;
        });
    } catch (error: any) {
      this.snapshot.lastError = this.isRestarting() ? null : (error?.message || String(error));
      this.setConnected(false);
      if (!this.isRestarting()) {
        this.triggerReconnect();
      }
      throw error;
    } finally {
      this.reconnectInFlight = false;
    }
  }

  private startRestartRecoveryLoop() {
    if (!this.isRestarting()) return;
    if (this.restartRecoveryInterval) return;

    const deadline = Number(this.snapshot.restartingUntil || 0);
    void this.reconnectNow().catch(() => {
      // ciclo do intervalo continua tentando
    });

    this.restartRecoveryInterval = setInterval(() => {
      if (this.snapshot.connected) {
        if (this.restartRecoveryInterval) {
          clearInterval(this.restartRecoveryInterval);
          this.restartRecoveryInterval = null;
        }
        if (this.restartHardTimeoutTimer) {
          clearTimeout(this.restartHardTimeoutTimer);
          this.restartHardTimeoutTimer = null;
        }
        this.startPolling();
        return;
      }

      if (Date.now() >= deadline) {
        if (this.restartRecoveryInterval) {
          clearInterval(this.restartRecoveryInterval);
          this.restartRecoveryInterval = null;
        }
        this.snapshot.lastError = 'Falha ao reconectar apos reinicio da central (timeout de 1 minuto).';
        this.snapshot.reconnecting = false;
        this.snapshot.restartingUntil = null;
        this.emit('cie.status.updated', this.getSnapshot());
        this.hardKillProcess('loop de reconexao de reinicio expirado');
        return;
      }

      void this.reconnectNow().catch(() => {
        // proxima tentativa ocorre automaticamente no proximo ciclo do intervalo
      });
    }, 1000);
  }

  private triggerReconnect() {
    if (this.reconnectTimer) return;

    this.snapshot.reconnecting = true;
    const attempt = this.snapshot.reconnectAttempt + 1;
    this.snapshot.reconnectAttempt = attempt;
    const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 6)));

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.reconnectNow();
      } catch {
        this.triggerReconnect();
      }
    }, delay);
  }

  // Os contadores do status contam eventos ATIVOS (lidos com getEvent 1..N);
  // o histórico (getLog) tem numeração própria em que 1 é o mais recente.
  // Por isso uma mudança de contador relê a lista de ativos e sincroniza o
  // histórico a partir do registro 1, em vez de usar o contador como índice.
  private async handleCounterChanges(previous: StatusCounters, current: StatusCounters) {
    for (const type of ACTIVE_TYPES) {
      const changed = current[type] !== previous[type];
      const stale = this.logService.active(type).length !== Math.min(current[type], this.options.activeEventsLimit);
      const retryAt = this.activeRetryAt[type] ?? 0;
      if (changed || (stale && Date.now() >= retryAt)) {
        await this.refreshActive(type, current[type]);
      }
      if (changed && type !== 'bloqueio') {
        await this.syncHistory(type);
      }
    }
  }

  private async warmup() {
    for (const type of HISTORY_TYPES) {
      await this.syncHistory(type);
    }
    const counters = this.getCounters();
    for (const type of ACTIVE_TYPES) {
      if (counters[type] > 0) await this.refreshActive(type, counters[type]);
    }
  }

  // Operações não têm contador no status: só aparecem por esta leitura periódica.
  private async periodicSync() {
    for (const type of HISTORY_TYPES) {
      await this.syncHistory(type);
    }
  }

  /** Lê o histórico a partir do registro mais recente até encontrar um já conhecido. */
  private async syncHistory(type: CieHistoricLogType): Promise<void> {
    const running = this.syncHistoryByType[type];
    if (running) return running;

    const run = (async () => {
      // Snapshot antes de ler: o listener onLog também grava cada resposta
      // no ring, e não pode fazer o registro novo parecer "já conhecido".
      const known = this.logService.knownKeys(type);
      const cap = known.size > 0 ? this.options.logBackfillLimit : Math.min(this.options.logBackfillLimit, INITIAL_SYNC_LIMIT);

      this.backfillInFlight += 1;
      try {
        for (let i = 1; i <= cap; i += 1) {
          const raw = await this.client.getLog(type, i);
          const total = Number(raw?.contador || 0);
          if (!Number.isFinite(total) || total <= 0) return;

          const log = this.logService.normalizeHistory(type, raw);
          if (log && known.has(log.key)) return;

          const added = this.logService.add(type, raw);
          if (added) this.emit('cie.log.received', added);
          if (i >= total) return;
        }
      } catch {
        // keep sync resilient: tenta de novo no próximo ciclo
      } finally {
        this.backfillInFlight = Math.max(0, this.backfillInFlight - 1);
      }
    })().finally(() => {
      delete this.syncHistoryByType[type];
    });

    this.syncHistoryByType[type] = run;
    return run;
  }

  /** Relê a lista de eventos ativos de um tipo (getEvent 1..contador). */
  private async refreshActive(type: CieActiveType, count: number) {
    if (count <= 0) {
      const hadItems = this.logService.active(type).length > 0;
      this.logService.clearActive(type);
      delete this.activeRetryAt[type];
      if (hadItems) this.emit('cie.active.updated', { type, items: [], counters: this.getCounters() });
      return;
    }

    const target = Math.min(count, this.options.activeEventsLimit);
    const raws: any[] = [];
    let failed = false;

    this.backfillInFlight += 1;
    try {
      for (let i = 1; i <= target; i += 1) {
        try {
          raws.push(await this.client.getEvent(type, i));
        } catch {
          failed = true;
          break;
        }
      }
    } finally {
      this.backfillInFlight = Math.max(0, this.backfillInFlight - 1);
    }

    // Sem resposta nenhuma, mantém a lista anterior e só tenta de novo depois
    // de um ciclo de sync, para não martelar a central a cada poll.
    if (raws.length === 0) {
      this.activeRetryAt[type] = Date.now() + this.options.logSyncMs;
      return;
    }
    this.activeRetryAt[type] = failed ? Date.now() + this.options.logSyncMs : 0;

    const items = this.logService.setActive(type, raws);
    this.emit('cie.active.updated', { type, items, counters: this.getCounters() });
  }

  async ensureLogs(type: CieLogType, limit: number): Promise<void> {
    const desired = Math.max(1, Math.min(200, Math.floor(limit || 1)));
    const existing = this.logService.latestByType(type, desired).length;
    if (existing >= desired) return;

    if (this.ensureByType[type]) {
      await this.ensureByType[type];
      return;
    }

    const run = (async () => {
      if (type === 'operacao') {
        await this.backfillLatestByLimit('operacao', desired);
        return;
      }

      if (type === 'alarme') {
        await this.backfillLatestByLimit('alarme', desired);
        return;
      }

      if (type === 'falha') {
        await this.backfillLatestByLimit('falha', desired);
        return;
      }

      if (type === 'supervisao') {
        await this.backfillLatestByLimit('supervisao', desired);
        return;
      }
    })()
      .finally(() => {
        delete this.ensureByType[type];
      });

    this.ensureByType[type] = run;
    await run;
  }

  private async backfillLatestByLimit(type: CieHistoricLogType, desiredLimit: number) {
    const target = Math.max(1, Math.min(this.options.logBackfillLimit, Math.floor(desiredLimit || 1)));

    this.backfillInFlight += 1;
    try {
      const first = await this.client.getLog(type, 1);
      const totalByPayload = Number(first?.contador || 0);
      const parsedTotal = Number.isFinite(totalByPayload) ? Math.floor(totalByPayload) : 0;
      if (parsedTotal <= 0) {
        return;
      }

      const firstNormalized = this.logService.add(type, first);
      if (firstNormalized) this.emit('cie.log.received', firstNormalized);

      const upperBound = Math.min(target, parsedTotal);

      for (let i = 2; i <= upperBound; i += 1) {
        try {
          const log = await this.client.getLog(type, i);
          const normalized = this.logService.add(type, log);
          if (normalized) this.emit('cie.log.received', normalized);
        } catch {
          // keep backfill resilient
        }
      }
    } catch {
      // keep backfill resilient
    } finally {
      this.backfillInFlight = Math.max(0, this.backfillInFlight - 1);
    }
  }

  isWarmingUp(): boolean {
    return this.warmupPromise !== null;
  }

  async waitForWarmup(maxWaitMs = 12000): Promise<boolean> {
    if (!this.warmupPromise) {
      return true;
    }

    let timeoutId: NodeJS.Timeout | null = null;
    try {
      await Promise.race([
        this.warmupPromise,
        new Promise<void>((resolve) => {
          timeoutId = setTimeout(resolve, Math.max(0, maxWaitMs));
        }),
      ]);
      return this.warmupPromise === null;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async stop() {
    this.stopPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.restartRecoveryInterval) {
      clearInterval(this.restartRecoveryInterval);
      this.restartRecoveryInterval = null;
    }
    if (this.restartRecoveryTimer) {
      clearTimeout(this.restartRecoveryTimer);
      this.restartRecoveryTimer = null;
    }
    if (this.restartHardTimeoutTimer) {
      clearTimeout(this.restartHardTimeoutTimer);
      this.restartHardTimeoutTimer = null;
    }
    await this.client.shutdown();
    this.snapshot.restartingUntil = null;
    this.setConnected(false);
  }
}
