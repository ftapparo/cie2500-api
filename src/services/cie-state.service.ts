import { EventEmitter } from 'node:events';
import type { CieClient } from '../core/cie-client';
import type { CieLogService } from './cie-log.service';
import type { CieHistoricLogType, CieLogType } from '../types/logs';
import type { CieStateSnapshot } from '../types/state';

type CieStateServiceOptions = {
  pollMs: number;
  logBackfillLimit: number;
};

type StatusCounters = {
  alarme: number;
  falha: number;
  supervisao: number;
  bloqueio: number;
};

function getCounters(status: any): StatusCounters {
  return {
    alarme: Number(status?.status?.alarme || 0),
    falha: Number(status?.status?.falha || 0),
    supervisao: Number(status?.status?.supervisao || 0),
    bloqueio: Number(status?.status?.bloqueio || 0),
  };
}

export class CieStateService extends EventEmitter {
  private readonly client: CieClient;
  private readonly logService: CieLogService;
  private readonly options: CieStateServiceOptions;

  private pollTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private snapshot: CieStateSnapshot = {
    connected: false,
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
    this.options = {
      pollMs: Math.max(3000, options.pollMs),
      logBackfillLimit: Math.max(1, options.logBackfillLimit),
    };
  }

  getSnapshot(): CieStateSnapshot {
    return { ...this.snapshot };
  }

  private setConnected(connected: boolean) {
    if (this.snapshot.connected === connected) return;
    this.snapshot.connected = connected;
    this.emit('connection.status.changed', { connected });
  }

  async start() {
    this.client.onLog((log) => {
      const normalized = this.logService.add('operacao', log);
      if (normalized) this.emit('cie.log.received', normalized);
    });

    this.client.onEvent((event) => {
      const typeMap: Record<number, CieLogType> = {
        0: 'alarme',
        1: 'falha',
        2: 'supervisao',
        3: 'bloqueio',
      };
      const type = typeMap[Number(event?.tipo_evento)] || 'operacao';
      const normalized = this.logService.add(type, event);
      if (normalized) this.emit('cie.log.received', normalized);
    });

    this.client.onConnectionStatus((connected) => {
      this.setConnected(connected);
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
      this.previousCounters = getCounters(initial.status);
      this.setConnected(true);
      this.emit('cie.status.updated', this.getSnapshot());
      void this.backfillAllTypes().catch(() => {
        // ignore initial backfill failures
      });
    } catch (error: any) {
      this.snapshot.lastError = error?.message || String(error);
      this.setConnected(false);
      this.triggerReconnect();
    }

    this.startPolling();
  }

  private startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.refreshNow();
    }, this.options.pollMs);
  }

  private stopPolling() {
    if (!this.pollTimer) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  async refreshNow() {
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
      this.setConnected(true);

      const currentCounters = getCounters(status);
      await this.handleCounterIncrements(this.previousCounters, currentCounters);
      this.previousCounters = currentCounters;

      if (currentCounters.alarme > 0) {
        this.emit('cie.alarm.triggered', this.logService.alarmSnapshot(currentCounters));
      }

      this.emit('cie.status.updated', this.getSnapshot());
    } catch (error: any) {
      this.snapshot.lastError = error?.message || String(error);
      this.setConnected(false);
      this.triggerReconnect();
    }
  }

  async reconnectNow() {
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
      this.previousCounters = getCounters(initial.status);
      this.setConnected(true);
      this.emit('cie.status.updated', this.getSnapshot());
      void this.backfillAllTypes().catch(() => {
        // ignore reconnect backfill failures
      });
    } catch (error: any) {
      this.snapshot.lastError = error?.message || String(error);
      this.setConnected(false);
      this.triggerReconnect();
      throw error;
    }
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

  private async handleCounterIncrements(previous: StatusCounters, current: StatusCounters) {
    if (current.alarme > previous.alarme) {
      await this.backfillByRange('alarme', previous.alarme, current.alarme);
    }
    if (current.falha > previous.falha) {
      await this.backfillByRange('falha', previous.falha, current.falha);
    }
    if (current.supervisao > previous.supervisao) {
      await this.backfillByRange('supervisao', previous.supervisao, current.supervisao);
    }
  }

  private async backfillAllTypes() {
    if (!this.snapshot.status) return;
    const counters = getCounters(this.snapshot.status);
    await this.backfillByRange('alarme', 0, counters.alarme);
    await this.backfillByRange('falha', 0, counters.falha);
    await this.backfillByRange('supervisao', 0, counters.supervisao);
    await this.backfillByRange('operacao', 0, Math.min(this.options.logBackfillLimit, 50));
  }

  private async backfillByRange(type: CieHistoricLogType, previousCounter: number, currentCounter: number) {
    if (currentCounter <= 0) return;
    const end = currentCounter;
    const start = Math.max(1, Math.max(previousCounter + 1, end - this.options.logBackfillLimit + 1));

    for (let i = start; i <= end; i += 1) {
      try {
        const log = await this.client.getLog(type, i);
        const normalized = this.logService.add(type, log);
        if (normalized) this.emit('cie.log.received', normalized);
      } catch {
        // keep polling loop resilient
      }
    }
  }

  async stop() {
    this.stopPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.client.shutdown();
    this.setConnected(false);
  }
}
