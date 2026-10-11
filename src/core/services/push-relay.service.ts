import { randomUUID } from 'crypto';

type EventLog = {
  loop?: number | null;
  address?: number | null;
  zoneName?: string | null;
  deviceName?: string | null;
  deviceTypeLabel?: string | null;
  occurredAt?: string | null;
  event?: { label?: string; kind?: string } | null;
  display?: {
    title?: string;
    device?: string | null;
    deviceName?: string | null;
    place?: {
      towerLabel?: string | null;
      floorLabel?: string | null;
      positionLabel?: string | null;
      area?: string | null;
      areaDetail?: string | null;
    } | null;
    loop?: number | null;
    address?: number | null;
  } | null;
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
  activeAlarms?: unknown[];
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
  activeFailures?: unknown[];
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

const formatDateTime = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return 'Data/Hora indisponível';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data/Hora indisponível';
  return `${parsed.toLocaleDateString('pt-BR')} ${parsed.toLocaleTimeString('pt-BR', { hour12: false })}`;
};

const asLogs = (value: unknown): EventLog[] => (Array.isArray(value) ? (value as EventLog[]) : []);

// Prioridade: evento ativo que é uma ativação real (ex.: Alarme 1, não a
// "Saída Confirmada" da sirene nem uma restauração), depois o histórico.
const pickEvent = (active: unknown, history: unknown): EventLog | undefined => {
  const activeLogs = asLogs(active);
  const historyLogs = asLogs(history);
  return activeLogs.find((log) => log.event?.kind === 'ativacao')
    ?? historyLogs.find((log) => log.event?.kind === 'ativacao')
    ?? activeLogs[0]
    ?? historyLogs[0];
};

// Push é texto puro: uma informação por linha, montada dos campos separados de display.
const buildBody = (log: EventLog | undefined, fallbackLabel: string): string => {
  const display = log?.display;
  const place = display?.place;
  const placeLine = place
    ? [place.towerLabel, place.area, place.areaDetail, place.floorLabel, place.positionLabel].filter(Boolean).join(', ')
    : null;
  const device = display?.device || normalizeLabel(log?.deviceTypeLabel, 'Dispositivo');
  const deviceName = display?.deviceName || log?.deviceName;
  const panelLine = typeof display?.loop === 'number'
    ? `Laço ${display.loop}, endereço ${display.address ?? '-'}`
    : null;

  return [
    log?.event?.label || fallbackLabel,
    placeLine ? `Local: ${placeLine}` : null,
    deviceName ? `${device}: ${deviceName}` : device,
    panelLine,
    `Data/Hora: ${formatDateTime(log?.occurredAt)}`,
  ].filter(Boolean).join('\n');
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

  /**
   * Com MAIN_API_V3_BASE_URL definida (ex.: http://nova-api:3031), envia pela
   * v3 da nova-api, autenticado por API_SERVICE_TOKEN; sem ela, segue na v2
   * como sempre. Lido a cada envio para trocar só com variável + restart.
   */
  private resolveTarget(requestId: string): { endpoint: string; headers: Record<string, string> } {
    const v3BaseUrl = normalizeBaseUrl(String(process.env.MAIN_API_V3_BASE_URL || ''));
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
    };

    if (v3BaseUrl) {
      return {
        endpoint: `${v3BaseUrl}/v3/api/push/send`,
        // x-service-name identifica o CIE no histórico de comandos da API (servico:cie).
        headers: { ...headers, Authorization: `Bearer ${process.env.API_SERVICE_TOKEN ?? ''}`, 'x-service-name': 'cie' },
      };
    }

    return { endpoint: `${this.baseUrl}/v2/api/push/send`, headers: { ...headers, 'x-user': 'CIE' } };
  }

  private async postGenericPush(
    requestId: string,
    payload: Record<string, unknown>,
    kind: 'fire-alarm' | 'failure-alarm',
  ): Promise<void> {
    const { endpoint, headers } = this.resolveTarget(requestId);
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
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
    const latestLog = pickEvent(data?.activeAlarms, data?.latestAlarmLogs);
    const alarmCount = Number(data?.counters?.alarme || 0);
    const alarmTitle = alarmCount > 1 ? `ALARME DE INCÊNDIO (${alarmCount} ativos)` : 'ALARME DE INCÊNDIO';
    const body = buildBody(latestLog, 'Alarme');

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

    // Falhas ativas que são só restauração/registro não justificam notificar.
    const activeFailures = asLogs(data?.activeFailures);
    if (activeFailures.length > 0
      && activeFailures.every((log) => log.event?.kind === 'restauracao' || log.event?.kind === 'informativo')) {
      console.log('[PushRelayService] failure-alarm ignorado: nenhuma falha ativa relevante.');
      return;
    }

    if (this.shouldSkipByCooldown('failure-alarm', this.lastFailureAlarmSentAt, this.failureAlarmCooldownMs)) return;

    const requestId = randomUUID();
    const latestLog = pickEvent(data?.activeFailures, data?.latestFailureLogs);
    const failureCount = Number(data?.counters?.falha || 0);
    const failureTitle = failureCount > 1 ? `FALHA NA CENTRAL (${failureCount} ativas)` : 'FALHA NA CENTRAL';
    const body = buildBody(latestLog, 'Falha');

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
