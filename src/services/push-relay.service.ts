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

  constructor() {
    this.baseUrl = normalizeBaseUrl(String(process.env.MAIN_API_BASE_URL || ''));
    this.timeoutMs = toNumber(process.env.MAIN_API_PUSH_TIMEOUT_MS, 3000);
    this.retries = Math.max(1, toNumber(process.env.MAIN_API_PUSH_RETRIES, 3));
  }

  isEnabled(): boolean {
    return Boolean(this.baseUrl);
  }

  async sendFireAlarm(data: FireAlarmEventPayload): Promise<void> {
    if (!this.isEnabled()) return;

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
}
