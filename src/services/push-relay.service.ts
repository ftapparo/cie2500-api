import { randomUUID } from 'crypto';

type EventLog = {
  loop?: number | null;
  address?: number | null;
  zoneName?: string | null;
  deviceName?: string | null;
  deviceTypeLabel?: string | null;
  occurredAt?: string | null;
};

type FireAlarmEventPayload = {
  source?: string;
  triggeredAt?: string;
  isTriggered?: boolean;
  counters?: {
    alarme?: number;
    falha?: number;
    supervisao?: number;
    bloqueio?: number;
  };
  latestAlarmLogs?: unknown[];
};

type FailureAlarmEventPayload = {
  source?: string;
  triggeredAt?: string;
  counters?: {
    alarme?: number;
    falha?: number;
    supervisao?: number;
    bloqueio?: number;
  };
  bipSilenced?: boolean;
  latestFailureLogs?: unknown[];
};

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, '');

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.trunc(parsed);
};

const normalizeLabel = (value: unknown, fallback = 'Não identificado'): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
};

const buildAddress = (log?: EventLog): string => {
  const loopNumber = typeof log?.loop === 'number' ? log.loop : null;
  const addressNumber = typeof log?.address === 'number' ? log.address : null;
  const loop = loopNumber !== null && Number.isFinite(loopNumber) ? `L${loopNumber}` : 'L-';
  const address = addressNumber !== null && Number.isFinite(addressNumber) ? `D${addressNumber}` : 'D-';
  return `${loop}${address}`;
};

const formatDateTime = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return 'Data/Hora indisponível';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data/Hora indisponível';
  return `${parsed.toLocaleDateString('pt-BR')} ${parsed.toLocaleTimeString('pt-BR', { hour12: false })}`;
};

export class PushRelayService {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly fireAlarmCooldownMs: number;
  private readonly failureAlarmCooldownMs: number;
  private lastFireAlarmSentAt = 0;
  private lastFailureAlarmSentAt = 0;

  constructor() {
    this.baseUrl = normalizeBaseUrl(String(process.env.MAIN_API_BASE_URL || ''));
    this.timeoutMs = toNumber(process.env.MAIN_API_PUSH_TIMEOUT_MS, 3000);
    this.retries = Math.max(1, toNumber(process.env.MAIN_API_PUSH_RETRIES, 3));
    this.fireAlarmCooldownMs = toNumber(process.env.CIE_PUSH_FIRE_ALARM_COOLDOWN_MS, 60000);
    this.failureAlarmCooldownMs = toNumber(process.env.CIE_PUSH_FAILURE_ALARM_COOLDOWN_MS, this.fireAlarmCooldownMs);
  }

  isEnabled(): boolean {
    return Boolean(this.baseUrl);
  }

  private shouldSkipByCooldown(
    kind: 'fire-alarm' | 'failure-alarm',
    lastSentAt: number,
    cooldownMs: number,
  ): boolean {
    const now = Date.now();
    const elapsedMs = now - lastSentAt;
    if (lastSentAt > 0 && elapsedMs < cooldownMs) {
      console.log(`[PushRelayService] ${kind} ignorado por cooldown`, {
        elapsedMs,
        cooldownMs,
        nextAllowedAt: lastSentAt + cooldownMs,
      });
      return true;
    }
    return false;
  }

  private async postGenericPush(
    requestId: string,
    payload: Record<string, unknown>,
    kind: 'fire-alarm' | 'failure-alarm',
  ): Promise<void> {
    const endpoint = `${this.baseUrl}/v2/api/push/send`;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-request-id': requestId,
            'x-user': 'CIE',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const responseText = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${response.statusText} ${responseText}`.trim());
        }

        console.log(`[PushRelayService] ${kind} enviado`, {
          requestId,
          attempt,
          elapsedMs: Date.now() - startedAt,
          endpoint,
        });
        return;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        const willRetry = attempt < this.retries;
        console.warn(`[PushRelayService] falha ao enviar ${kind}`, {
          requestId,
          attempt,
          retries: this.retries,
          willRetry,
          error: error instanceof Error ? error.message : error,
          endpoint,
        });

        if (willRetry) {
          const backoffMs = Math.min(1000 * attempt, 3000);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw (lastError instanceof Error ? lastError : new Error(`Falha ao enviar ${kind} para API principal.`));
  }

  async sendFireAlarm(data: FireAlarmEventPayload): Promise<void> {
    if (!this.isEnabled()) return;

    if (this.shouldSkipByCooldown('fire-alarm', this.lastFireAlarmSentAt, this.fireAlarmCooldownMs)) return;

    const requestId = randomUUID();
    const latestLog = Array.isArray(data?.latestAlarmLogs) && data.latestAlarmLogs.length > 0
      ? data.latestAlarmLogs[0] as EventLog
      : undefined;
    const alarmCount = Number(data?.counters?.alarme || 0);
    const alarmTitle = alarmCount > 0 ? 'SISTEMA EM ALARME' : 'ALARME DE INCENDIO';

    const body = [
      `${buildAddress(latestLog)} - ${normalizeLabel(latestLog?.zoneName || latestLog?.deviceName)}`,
      `Disp. em Alarme | Tipo: ${normalizeLabel(latestLog?.deviceTypeLabel, 'Não informado')}`,
      `Zona: ${normalizeLabel(latestLog?.zoneName)} | Dispositivo: ${normalizeLabel(latestLog?.deviceName)}`,
      `Laço/Endereço: ${buildAddress(latestLog)} | Data/Hora: ${formatDateTime(latestLog?.occurredAt)}`,
    ].join('\n');

    await this.postGenericPush(requestId, {
      title: alarmTitle,
      body,
      tag: 'fire-alarm',
      requireInteraction: true,
      data: {
        url: '/dashboard/incendio',
        source: data?.source || 'CIE2500',
        triggeredAt: data?.triggeredAt || new Date().toISOString(),
        counters: data?.counters || {},
        type: 'fire-alarm',
      },
    }, 'fire-alarm');

    this.lastFireAlarmSentAt = Date.now();
  }

  async sendFailureAlarm(data: FailureAlarmEventPayload): Promise<void> {
    if (!this.isEnabled()) return;

    if (data?.bipSilenced === true) {
      console.log('[PushRelayService] failure-alarm ignorado: bip silenciado.', {
        triggeredAt: data?.triggeredAt || new Date().toISOString(),
      });
      return;
    }

    if (this.shouldSkipByCooldown('failure-alarm', this.lastFailureAlarmSentAt, this.failureAlarmCooldownMs)) return;

    const requestId = randomUUID();
    const latestLog = Array.isArray(data?.latestFailureLogs) && data.latestFailureLogs.length > 0
      ? data.latestFailureLogs[0] as EventLog
      : undefined;
    const failureCount = Number(data?.counters?.falha || 0);
    const failureTitle = failureCount > 0 ? 'SISTEMA EM FALHA' : 'FALHA NA CENTRAL';

    const body = [
      `${buildAddress(latestLog)} - ${normalizeLabel(latestLog?.zoneName || latestLog?.deviceName)}`,
      `Disp. em Falha | Tipo: ${normalizeLabel(latestLog?.deviceTypeLabel, 'Não informado')}`,
      `Zona: ${normalizeLabel(latestLog?.zoneName)} | Dispositivo: ${normalizeLabel(latestLog?.deviceName)}`,
      `Laço/Endereço: ${buildAddress(latestLog)} | Data/Hora: ${formatDateTime(latestLog?.occurredAt)}`,
    ].join('\n');

    await this.postGenericPush(requestId, {
      title: failureTitle,
      body,
      tag: 'failure-alarm',
      requireInteraction: true,
      data: {
        url: '/dashboard/incendio',
        source: data?.source || 'CIE2500',
        triggeredAt: data?.triggeredAt || new Date().toISOString(),
        counters: data?.counters || {},
        type: 'failure-alarm',
      },
    }, 'failure-alarm');

    this.lastFailureAlarmSentAt = Date.now();
  }
}
