import http from 'http';
import { CieClient } from './cie-client';
import { CieCommandService } from '../services/cie-command.service';
import { CieLogService } from '../services/cie-log.service';
import { CieStateService } from '../services/cie-state.service';
import { PushRelayService } from '../services/push-relay.service';
import { CieWsBroker } from '../ws/cie-ws-broker';

export type CieManagerConfig = {
  name: string;
  webserverPort: number;
};

export class CieManager {
  public fireCentral: CieManagerConfig;
  private wsBroker: CieWsBroker | null = null;

  private readonly cieClient: CieClient;
  private readonly cieLogService: CieLogService;
  private readonly cieStateService: CieStateService;
  private readonly cieCommandService: CieCommandService;
  private readonly pushRelayService: PushRelayService;

  constructor(config: CieManagerConfig) {
    this.fireCentral = config;

    const CIE_IP = process.env.CIE_IP || '192.168.0.4';
    const CIE_PASSWORD = process.env.CIE_PASSWORD || '444444';
    const CIE_ENDERECO = Number(process.env.CIE_ENDERECO ?? 0);
    const CIE_POLL_MS = Number(process.env.CIE_POLL_MS || 1000);
    const CIE_REQUEST_TIMEOUT_MS = Number(process.env.CIE_REQUEST_TIMEOUT_MS || 10000);
    const CIE_LOG_BACKFILL_LIMIT = Number(process.env.CIE_LOG_BACKFILL_LIMIT || 50);
    const CIE_LOG_RING_SIZE = Number(process.env.CIE_LOG_RING_SIZE || 1000);

    this.cieClient = new CieClient({
      ip: CIE_IP,
      password: CIE_PASSWORD,
      endereco: CIE_ENDERECO,
      timeoutMs: CIE_REQUEST_TIMEOUT_MS,
    });
    this.cieLogService = new CieLogService(CIE_LOG_RING_SIZE);
    this.cieStateService = new CieStateService(this.cieClient, this.cieLogService, {
      pollMs: CIE_POLL_MS,
      logBackfillLimit: CIE_LOG_BACKFILL_LIMIT,
    });
    this.cieCommandService = new CieCommandService(this.cieClient);
    this.pushRelayService = new PushRelayService();
  }

  public async connectToCie() {
    await this.cieStateService.start();
  }

  public bindWebSocket(server: http.Server) {
    if (this.wsBroker) return;

    this.wsBroker = new CieWsBroker(server, '/v1/ws');
    this.cieStateService.on('connection.status.changed', (data) => {
      this.wsBroker?.publish('connection.status.changed', data);
    });
    this.cieStateService.on('cie.status.updated', (data) => {
      this.wsBroker?.publish('cie.status.updated', data);
    });
    this.cieStateService.on('cie.alarm.triggered', (data) => {
      this.wsBroker?.publish('cie.alarm.triggered', data);
      if (!this.pushRelayService.isEnabled()) return;
      void this.pushRelayService.sendFireAlarm(data).catch((error) => {
        console.error('[CieManager] Falha ao enviar fire-alarm para API principal:', error);
      });
    });
    this.cieStateService.on('cie.failure.triggered', (data) => {
      this.wsBroker?.publish('cie.failure.triggered', data);
      if (!this.pushRelayService.isEnabled()) return;
      void this.pushRelayService.sendFailureAlarm(data).catch((error) => {
        console.error('[CieManager] Falha ao enviar failure-alarm para API principal:', error);
      });
    });
    this.cieStateService.on('cie.log.received', (data) => {
      this.wsBroker?.publish('cie.log.received', data);
    });
  }

  public getStateService() {
    return this.cieStateService;
  }

  public getLogService() {
    return this.cieLogService;
  }

  public getCommandService() {
    return this.cieCommandService;
  }

  public async shutdown() {
    this.wsBroker?.close();
    this.wsBroker = null;
    await this.cieStateService.stop();
  }
}
