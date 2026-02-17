import { randomUUID } from 'crypto';

type FireAlarmEventPayload = {
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

  async sendFireAlarm(data: FireAlarmEventPayload): Promise<void> {
    if (!this.isEnabled()) return;

    if (this.shouldSkipByCooldown('fire-alarm', this.lastFireAlarmSentAt, this.fireAlarmCooldownMs)) return;

    const requestId = randomUUID();
    const endpoint = `${this.baseUrl}/v2/api/push/events/fire-alarm`;
    const body = {
      source: 'CIE2500',
      triggeredAt: new Date().toISOString(),
      counters: data?.counters || {},
      latestAlarmLogs: Array.isArray(data?.latestAlarmLogs) ? data.latestAlarmLogs : [],
    };

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
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const responseText = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${response.statusText} ${responseText}`.trim());
        }

        console.log('[PushRelayService] fire-alarm enviado', {
          requestId,
          attempt,
          elapsedMs: Date.now() - startedAt,
          endpoint,
        });
        this.lastFireAlarmSentAt = Date.now();
        return;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        const willRetry = attempt < this.retries;
        console.warn('[PushRelayService] falha ao enviar fire-alarm', {
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

    throw (lastError instanceof Error ? lastError : new Error('Falha ao enviar fire-alarm para API principal.'));
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
    const endpoint = `${this.baseUrl}/v2/api/push/send`;
    const failureCount = Number(data?.counters?.falha || 0);
    const body = {
      title: 'Falha na Central de Incendio',
      body: failureCount > 0
        ? `Foram detectadas ${failureCount} falha(s) ativa(s) na central.`
        : 'Foi detectada uma falha na central de incendio.',
      tag: 'failure-alarm',
      requireInteraction: true,
      data: {
        url: '/dashboard/incendio',
        source: data?.source || 'CIE2500',
        triggeredAt: data?.triggeredAt || new Date().toISOString(),
        counters: data?.counters || {},
        type: 'failure-alarm',
      },
    };

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
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const responseText = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${response.statusText} ${responseText}`.trim());
        }

        console.log('[PushRelayService] failure-alarm enviado', {
          requestId,
          attempt,
          elapsedMs: Date.now() - startedAt,
          endpoint,
        });
        this.lastFailureAlarmSentAt = Date.now();
        return;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        const willRetry = attempt < this.retries;
        console.warn('[PushRelayService] falha ao enviar failure-alarm', {
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

    throw (lastError instanceof Error ? lastError : new Error('Falha ao enviar failure-alarm para API principal.'));
  }
}
