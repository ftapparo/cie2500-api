import { trimNulls } from '../utils';
import type { AlarmActiveSnapshot, CieDeviceClassification, CieLogType, NormalizedCieLog } from '../types/logs';

type ListOptions = {
  type?: CieLogType;
  limit: number;
  cursor?: string;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = trimNulls(value).trim();
  return cleaned.length ? cleaned : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseFlexibleNumber(value: unknown, fallback: number, max: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.floor(value);
    if (n >= 0 && n <= max) return n;
  }

  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase();
    if (!raw) return fallback;

    const decimalCandidate = Number(raw);
    if (Number.isFinite(decimalCandidate)) {
      const n = Math.floor(decimalCandidate);
      if (n >= 0 && n <= max) return n;
    }

    if (raw.startsWith('0x') || /[a-f]/.test(raw)) {
      const hex = parseInt(raw.replace(/^0x/, ''), 16);
      if (Number.isFinite(hex) && hex >= 0 && hex <= max) return hex;
    }
  }

  return fallback;
}

function parseOccurredAt(raw: any): string {
  const dataStr = typeof raw?.data === 'string' ? raw.data.trim() : '';
  const horaStr = typeof raw?.hora === 'string' ? raw.hora.trim() : '';
  const dateMatch = dataStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const timeMatch = horaStr.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);

  if (dateMatch && timeMatch) {
    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const year = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]);
    const min = Number(timeMatch[2]);
    const sec = Number(timeMatch[3]);
    const valid = [day, month, year, hour, min, sec].every(Number.isFinite);
    if (valid) {
      return new Date(year, month - 1, day, hour, min, sec).toISOString();
    }
  }

  const rawDate = raw?.date;
  if (!rawDate || typeof rawDate !== 'object') {
    return new Date().toISOString();
  }

  const year = Number(rawDate.year);
  const month = parseFlexibleNumber(rawDate.month, 1, 12);
  const day = parseFlexibleNumber(rawDate.day, 1, 31);
  const hour = parseFlexibleNumber(rawDate.hour, 0, 23);
  const min = parseFlexibleNumber(rawDate.min, 0, 59);
  const sec = parseFlexibleNumber(rawDate.sec, 0, 59);

  if (!Number.isFinite(year) || year < 2000 || year > 2099) {
    return new Date().toISOString();
  }

  return new Date(year, month - 1, day, hour, min, sec).toISOString();
}

const DEVICE_TYPE_LABELS: Record<number, string> = {
  0: 'Ausente',
  1: 'Sensor de Fumaca',
  2: 'Sensor de Temperatura',
  3: 'Acionador Manual',
  4: 'Modulo de Zona',
  5: 'Modulo de Entrada',
  9: 'Modulo de Entrada/Saida',
  10: 'Sirene Audiovisual',
  11: 'Alimentacao',
};

const DEVICE_SUBTYPE_LABELS: Record<number, string> = {
  0: 'Nao informado',
  1: 'Sensor de Fumaca',
  2: 'Sensor de Temperatura',
  3: 'Acionador Manual',
  4: 'Modulo de Zona',
  5: 'Modulo de Entrada',
  9: 'Modulo de Entrada/Saida',
  10: 'Sirene Audiovisual',
  11: 'Alimentacao',
  12: 'Acionador Manual',
};

function inferByName(deviceName: string | null): string | null {
  if (!deviceName) return null;
  const normalized = trimNulls(deviceName).trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('fuma')) return 'Sensor de Fumaca';
  if (normalized.includes('temper')) return 'Sensor de Temperatura';
  if (normalized.includes('acionador') || normalized.includes('botoeira')) return 'Acionador Manual';
  if (normalized.includes('sirene')) return 'Sirene Audiovisual';
  if (normalized.includes('aliment')) return 'Alimentacao';
  if (normalized.includes('modulo')) return 'Modulo';
  return null;
}

function classifyDevice(raw: any, deviceName: string | null): CieDeviceClassification | null {
  const typeCode = toNumber(raw?.tipo_dispositivo);
  const subtypeCode = toNumber(raw?.subtipo_dispositivo);
  const typeLabel = typeCode !== null ? (DEVICE_TYPE_LABELS[typeCode] ?? null) : null;
  const subtypeLabel = subtypeCode !== null ? (DEVICE_SUBTYPE_LABELS[subtypeCode] ?? null) : null;
  const inferred = inferByName(deviceName);
  const resolvedLabel = subtypeLabel || typeLabel || inferred || null;

  if (
    typeCode === null
    && subtypeCode === null
    && !typeLabel
    && !subtypeLabel
    && !resolvedLabel
  ) {
    return null;
  }

  return {
    typeCode,
    subtypeCode,
    typeLabel,
    subtypeLabel,
    resolvedLabel,
    source: subtypeLabel || typeLabel ? 'codes' : (inferred ? 'name' : 'none'),
  };
}

export class CieLogService {
  private readonly ringSize: number;
  private readonly logs: NormalizedCieLog[] = [];
  private readonly dedup = new Set<string>();

  constructor(ringSize: number) {
    this.ringSize = Math.max(100, ringSize);
  }

  reset() {
    this.logs.length = 0;
    this.dedup.clear();
  }

  add(type: CieLogType, raw: any): NormalizedCieLog | null {
    const typeByEvent: Record<number, CieLogType> = {
      0: 'alarme',
      1: 'falha',
      2: 'supervisao',
      3: 'operacao',
    };
    const resolvedType = typeByEvent[Number(raw?.tipo_evento)] || type;
    const id = toNumber(raw?.id) ?? 0;
    const address = toNumber(raw?.endereco);
    const zone = toNumber(raw?.zona);
    const loop = toNumber(raw?.laco);
    const occurredAt = parseOccurredAt(raw);
    const key = `${resolvedType}:${id}:${address ?? 'na'}:${occurredAt}`;
    if (this.dedup.has(key)) return null;

    const deviceName = normalizeString(raw?.nome_dispositivo);
    const log: NormalizedCieLog = {
      key,
      type: resolvedType,
      id,
      zone,
      address,
      loop,
      deviceName,
      zoneName: normalizeString(raw?.nome_zona),
      deviceClassification: classifyDevice(raw, deviceName),
      eventType: toNumber(raw?.tipo),
      blocked: typeof raw?.bloqueado === 'boolean' ? raw.bloqueado : (toNumber(raw?.bloqueado) === 1),
      occurredAt,
      raw,
      createdAt: Date.now(),
    };

    this.logs.push(log);
    this.dedup.add(key);
    while (this.logs.length > this.ringSize) {
      const removed = this.logs.shift();
      if (removed) this.dedup.delete(removed.key);
    }

    return log;
  }

  latestByType(type: CieLogType, limit = 20): NormalizedCieLog[] {
    const list = this.logs.filter((l) => l.type === type);
    list.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return list.slice(0, Math.max(1, limit));
  }

  latestReceivedByType(type: CieLogType, limit = 20): NormalizedCieLog[] {
    const list = this.logs.filter((l) => l.type === type);
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list.slice(0, Math.max(1, limit));
  }

  list(options: ListOptions): { items: NormalizedCieLog[]; nextCursor: string | null } {
    const safeLimit = Math.min(200, Math.max(1, options.limit));
    const offset = Math.max(0, Number(options.cursor || 0) || 0);

    const source = options.type
      ? this.logs.filter((l) => l.type === options.type)
      : [...this.logs];
    source.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    const items = source.slice(offset, offset + safeLimit);
    const nextOffset = offset + safeLimit;
    const nextCursor = nextOffset < source.length ? String(nextOffset) : null;
    return { items, nextCursor };
  }

  alarmSnapshot(counters: AlarmActiveSnapshot['counters']): AlarmActiveSnapshot {
    return {
      isTriggered: counters.alarme > 0,
      counters,
      latestAlarmLogs: this.latestByType('alarme', 20),
    };
  }
}
