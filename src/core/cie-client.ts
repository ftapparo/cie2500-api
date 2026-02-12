import { RequestQueue } from '../utils';
import { CIE2500Native } from '../native/CIE2500Native';
import type { DataHora, Info, Mac, NomeModelo, Status } from '../types/cie';
import type { CieLogType } from '../types/logs';

export type CieClientOptions = {
  ip: string;
  password: string;
  endereco: number;
  timeoutMs: number;
};

export class CieClient {
  private readonly queue = new RequestQueue();
  private readonly cie = new CIE2500Native();
  private connected = false;
  private readonly opts: CieClientOptions;

  constructor(opts: CieClientOptions) {
    this.opts = opts;
    this.cie.setRequestTimeoutMs(opts.timeoutMs);
    this.cie.onConnectionStatus((isConnected) => {
      this.connected = isConnected;
    });
  }

  isConnected() {
    return this.connected;
  }

  async connect() {
    return this.queue.run(async () => {
      try {
        await this.cie.discover(true);
      } catch {
        // best effort only
      }

      const token = await this.cie.authenticate(this.opts.ip, this.opts.password, this.opts.endereco);
      await this.cie.startCommunication(this.opts.ip, this.opts.endereco, token);
      this.connected = true;
    });
  }

  async reconnect() {
    return this.queue.run(async () => {
      try {
        await this.cie.stopCommunication();
      } catch {
        // ignore
      }
      this.connected = false;
      await this.connect();
    });
  }

  async disconnect() {
    return this.queue.run(async () => {
      try {
        await this.cie.stopCommunication();
      } finally {
        this.connected = false;
      }
    });
  }

  async shutdown() {
    return this.queue.run(async () => {
      this.connected = false;
      await this.cie.shutdown();
    });
  }

  async readInitial(): Promise<{
    nomeModelo: NomeModelo;
    mac: Mac;
    info: Info;
    dataHora: DataHora;
    status: Status;
  }> {
    return this.queue.run(async () => {
      const [nomeModelo, mac, info, dataHora, status] = await Promise.all([
        this.cie.nomeModelo(this.opts.ip, this.opts.endereco),
        this.cie.mac(this.opts.ip, this.opts.endereco),
        this.cie.info(this.opts.ip, this.opts.endereco),
        this.cie.dataHora(this.opts.ip, this.opts.endereco),
        this.cie.status(this.opts.ip, this.opts.endereco),
      ]);

      return { nomeModelo, mac, info, dataHora, status };
    });
  }

  async status(): Promise<Status> {
    return this.queue.run(async () => this.cie.status(this.opts.ip, this.opts.endereco));
  }

  async dataHora(): Promise<DataHora> {
    return this.queue.run(async () => this.cie.dataHora(this.opts.ip, this.opts.endereco));
  }

  async getLog(type: CieLogType, number: number): Promise<any> {
    return this.queue.run(async () => this.cie.getLog(this.opts.ip, this.opts.endereco, type, number));
  }

  async getEvent(type: 'alarme' | 'falha' | 'supervisao' | 'bloqueio', number: number): Promise<any> {
    return this.queue.run(async () => this.cie.getEvent(this.opts.ip, this.opts.endereco, type, number));
  }

  async sendButtonCommand(button: number, parameter: number, identifier: number): Promise<any> {
    return this.queue.run(async () =>
      this.cie.sendButtonCommand(this.opts.ip, this.opts.endereco, button, parameter, identifier)
    );
  }

  onLog(fn: (e: any) => void) {
    return this.cie.onLog(fn);
  }

  onEvent(fn: (e: any) => void) {
    return this.cie.onEvento(fn);
  }

  onConnectionStatus(fn: (connected: boolean) => void) {
    return this.cie.onConnectionStatus(fn);
  }
}
