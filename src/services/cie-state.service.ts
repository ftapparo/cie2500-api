import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
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
  private restartRecoveryTimer: NodeJS.Timeout | null = null;
  private restartRecoveryInterval: NodeJS.Timeout | null = null;
  private restartHardTimeoutTimer: NodeJS.Timeout | null = null;
  private warmupPromise: Promise<void> | null = null;
  private backfillInFlight = 0;
  private ensureByType: Partial<Record<CieLogType, Promise<void>>> = {};
  private reconnectInFlight = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;

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
    this.options = {
      pollMs: Math.max(1000, options.pollMs),
      logBackfillLimit: Math.max(1, options.logBackfillLimit),
    };
  }

  getSnapshot(): CieStateSnapshot {
    return { ...this.snapshot };
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
      this.warmupPromise = this.backfillAllTypes()
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
      await this.handleCounterIncrements(this.previousCounters, currentCounters);
      this.previousCounters = currentCounters;

      if (currentCounters.alarme > 0) {
        this.emit('cie.alarm.triggered', this.logService.alarmSnapshot(currentCounters));
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
      this.warmupPromise = this.backfillAllTypes()
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
    const initialLimit = Math.min(this.options.logBackfillLimit, 20);
    await this.backfillLatestByLimit('alarme', initialLimit);
    await this.backfillLatestByLimit('falha', initialLimit);
    await this.backfillLatestByLimit('supervisao', initialLimit);
    await this.backfillLatestByLimit('operacao', initialLimit);
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

  private async backfillByRange(type: CieHistoricLogType, previousCounter: number, currentCounter: number) {
    if (currentCounter <= 0) return;
    const end = currentCounter;
    const start = Math.max(1, Math.max(previousCounter + 1, end - this.options.logBackfillLimit + 1));

    this.backfillInFlight += 1;
    try {
      for (let i = start; i <= end; i += 1) {
        try {
          const log = await this.client.getLog(type, i);
          const normalized = this.logService.add(type, log);
          if (normalized) this.emit('cie.log.received', normalized);
        } catch {
          // keep polling loop resilient
        }
      }
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
