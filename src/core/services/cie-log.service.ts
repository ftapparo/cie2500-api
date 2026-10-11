import { trimNulls } from '../utils';
import { describeDevice, describeEvent } from './cie-event-catalog';
import { findDevice, placeOf, ruleName, zoneName as zoneNameById } from './cie-installation';
import type {
  AlarmActiveSnapshot,
  CieActiveEvents,
  CieActiveType,
  CieCounters,
  CieDeviceClassification,
  CieEventInfo,
  CieEventKind,
  CieLogDisplay,
  CieLogType,
  NormalizedCieLog,
} from '../../types/logs';

type ListOptions = {
  type?: CieLogType;
  kind?: CieEventKind;
  limit: number;
  cursor?: string;
};

type LogSource = NormalizedCieLog['source'];

// O mesmo índice de categoria significa coisas diferentes em cada canal da
// central: no histórico (getLog) 3 é operação; nos eventos ativos (getEvent) 3 é bloqueio.
const HISTORY_CATEGORY: Record<number, CieLogType> = { 0: 'alarme', 1: 'falha', 2: 'supervisao', 3: 'operacao' };
const ACTIVE_CATEGORY: Record<number, CieActiveType> = { 0: 'alarme', 1: 'falha', 2: 'supervisao', 3: 'bloqueio' };

export const ACTIVE_TYPES: CieActiveType[] = ['alarme', 'falha', 'supervisao', 'bloqueio'];

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = trimNulls(value)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/ÿ/gi, '')
    .trim();
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

// A central envia data/hora local de Brasilia (UTC-3, sem horario de verao), independente do TZ do processo.
const CIE_UTC_OFFSET_HOURS = -3;

function localCieTimeToIso(year: number, month: number, day: number, hour: number, min: number, sec: number): string {
  return new Date(Date.UTC(year, month - 1, day, hour - CIE_UTC_OFFSET_HOURS, min, sec)).toISOString();
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
      return localCieTimeToIso(year, month, day, hour, min, sec);
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

  return localCieTimeToIso(year, month, day, hour, min, sec);
}

function isGarbageLogPayload(raw: any, address: number | null, zone: number | null, loop: number | null): boolean {
  const rawDevice = String(raw?.nome_dispositivo ?? '');
  const rawZone = String(raw?.nome_zona ?? '');
  const containsFfGarbage = /ÿ{3,}/i.test(rawDevice) || /ÿ{3,}/i.test(rawZone);
  const invalidAddressing = address === 255 || zone === 255 || loop === 255;
  const totalByPayload = Number(raw?.contador || 0);
  const hasNoCounter = !Number.isFinite(totalByPayload) || totalByPayload <= 0;
  return hasNoCounter && (invalidAddressing || containsFfGarbage);
}

type DisplayInput = {
  event: CieEventInfo;
  device: CieDeviceClassification | null;
  deviceName: string | null;
  loop: number | null;
  address: number | null;
  zone: number | null;
  zoneName: string | null;
  localOutput: string | null;
  registeredName: string | null;
  registeredZone: number | null;
};

// Operações em que o endereço do registro é o número de uma regra ou zona
// (ex.: 49 "Regra Acionada" com endereço 7 = regra 7 "TORRE C").
const RULE_OPERATIONS = new Set([8, 16, 20, 21, 34, 35, 36, 37, 48, 49, 52]);
const ZONE_OPERATIONS = new Set([23, 38, 39]);

// Cada dado em seu campo, já interpretado: o cliente só escolhe o layout.
function buildDisplay(input: DisplayInput): CieLogDisplay {
  const { event, device, deviceName, loop, address, zone, zoneName, localOutput, registeredName, registeredZone } = input;

  if (event.category === 'operacao') {
    const code = event.code ?? -1;
    if (RULE_OPERATIONS.has(code) && address) {
      const name = ruleName(address) ?? deviceName;
      return {
        title: event.label, device: null, deviceName, place: placeOf(null, name, null, null),
        rule: { id: address, name }, loop: null, address: null, zone: null, zoneName: null,
      };
    }
    if (ZONE_OPERATIONS.has(code) && address) {
      const name = zoneNameById(address) ?? deviceName;
      return {
        title: event.label, device: null, deviceName, place: placeOf(null, name, address, name),
        rule: null, loop: null, address: null, zone: address, zoneName: name,
      };
    }
    return {
      title: event.label, device: null, deviceName, place: null,
      rule: null, loop: null, address: null, zone: null, zoneName: null,
    };
  }

  const onLoop = loop !== null && loop > 0;
  const validZone = zone !== null && zone > 0 ? zone : null;
  return {
    title: event.label,
    device: device?.resolvedLabel ?? null,
    deviceName,
    // Registro antigo pode ter nome genérico (ex.: "Acionador Man."): o endereço
    // físico é o mesmo, então o local cai para o cadastro atual da central.
    place: placeOf(loop, deviceName, validZone, zoneName, localOutput)
      ?? placeOf(loop, registeredName, registeredZone, null, localOutput),
    rule: null,
    loop: onLoop ? loop : null,
    address: onLoop ? address : null,
    zone: validZone,
    zoneName,
  };
}

function normalize(raw: any, category: CieLogType, source: LogSource): NormalizedCieLog | null {
  const id = toNumber(raw?.id) ?? 0;
  const address = toNumber(raw?.endereco);
  const zone = toNumber(raw?.zona);
  const loop = toNumber(raw?.laco);
  if (isGarbageLogPayload(raw, address, zone, loop)) return null;

  const occurredAt = parseOccurredAt(raw);
  const eventType = toNumber(raw?.tipo);
  const event = describeEvent(category, eventType);
  // Cadastro da central completa o que o UDP não traz (operações não têm dispositivo).
  const registered = category === 'operacao' ? null : findDevice(loop, address);
  const deviceName = normalizeString(raw?.nome_dispositivo) ?? registered?.name ?? null;
  const zoneName = normalizeString(raw?.nome_zona) ?? zoneNameById(zone);
  const deviceClassification = registered
    ? describeDevice(registered.type, registered.subtype, deviceName, true)
    : describeDevice(toNumber(raw?.tipo_dispositivo), toNumber(raw?.subtipo_dispositivo), deviceName);

  return {
    key: `${category}:${id}:${address ?? 'na'}:${occurredAt}`,
    type: category,
    id,
    zone,
    address,
    loop,
    deviceName,
    zoneName,
    deviceTypeCode: deviceClassification?.typeCode ?? null,
    deviceTypeLabel: deviceClassification?.typeLabel ?? deviceClassification?.resolvedLabel ?? null,
    deviceClassification,
    eventType,
    blocked: typeof raw?.bloqueado === 'boolean' ? raw.bloqueado : (toNumber(raw?.bloqueado) === 1),
    occurredAt,
    raw,
    createdAt: Date.now(),
    source,
    event,
    display: buildDisplay({
      event, device: deviceClassification, deviceName, loop, address, zone, zoneName,
      localOutput: registered?.localOutput ?? null,
      registeredName: registered?.name ?? null,
      registeredZone: registered?.zone ?? null,
    }),
    number: toNumber(raw?.numero),
    firstEvent: typeof raw?.primeiro_evento === 'boolean' ? raw.primeiro_evento : null,
    origin: toNumber(raw?.origem),
    repeater: toNumber(raw?.repetidora),
    historyTotal: source === 'historico' ? toNumber(raw?.contador) : null,
  };
}

function emptyActive(): CieActiveEvents {
  return { alarme: [], falha: [], supervisao: [], bloqueio: [] };
}

export class CieLogService {
  private readonly ringSize: number;
  private readonly logs: NormalizedCieLog[] = [];
  private readonly dedup = new Set<string>();
  private activeEvents: CieActiveEvents = emptyActive();

  constructor(ringSize: number) {
    this.ringSize = Math.max(100, ringSize);
  }

  reset() {
    this.logs.length = 0;
    this.dedup.clear();
    this.activeEvents = emptyActive();
  }

  /** Normaliza um registro do histórico (getLog) sem armazenar. */
  normalizeHistory(type: CieLogType, raw: any): NormalizedCieLog | null {
    const resolvedType = HISTORY_CATEGORY[Number(raw?.tipo_evento)] || type;
    return normalize(raw, resolvedType, 'historico');
  }

  has(key: string): boolean {
    return this.dedup.has(key);
  }

  knownKeys(type: CieLogType): Set<string> {
    return new Set(this.logs.filter((l) => l.type === type).map((l) => l.key));
  }

  add(type: CieLogType, raw: any): NormalizedCieLog | null {
    const log = this.normalizeHistory(type, raw);
    if (!log || this.dedup.has(log.key)) return null;

    this.logs.push(log);
    this.dedup.add(log.key);
    while (this.logs.length > this.ringSize) {
      const removed = this.logs.shift();
      if (removed) this.dedup.delete(removed.key);
    }

    return log;
  }

  /** Substitui a lista de eventos ativos (getEvent) de um tipo. */
  setActive(type: CieActiveType, raws: any[]): NormalizedCieLog[] {
    const items: NormalizedCieLog[] = [];
    for (const raw of raws) {
      const category = ACTIVE_CATEGORY[Number(raw?.tipo_evento)] || type;
      const item = normalize(raw, category, 'ativo');
      if (item) items.push(item);
    }
    items.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    this.activeEvents[type] = items;
    return items;
  }

  clearActive(type: CieActiveType) {
    this.activeEvents[type] = [];
  }

  active(type: CieActiveType): NormalizedCieLog[] {
    return [...this.activeEvents[type]];
  }

  activeAll(): CieActiveEvents {
    return {
      alarme: this.active('alarme'),
      falha: this.active('falha'),
      supervisao: this.active('supervisao'),
      bloqueio: this.active('bloqueio'),
    };
  }

  latestByType(type: CieLogType, limit = 20): NormalizedCieLog[] {
    const list = this.logs.filter((l) => l.type === type);
    list.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return list.slice(0, Math.max(1, limit));
  }

  /** Último registro do histórico daquele tipo com a natureza pedida (ex.: só ativações). */
  latestByKind(type: CieLogType, kind: CieEventKind): NormalizedCieLog | null {
    const list = this.logs.filter((l) => l.type === type && l.event.kind === kind);
    list.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return list[0] ?? null;
  }

  latestReceivedByType(type: CieLogType, limit = 20): NormalizedCieLog[] {
    const list = this.logs.filter((l) => l.type === type);
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list.slice(0, Math.max(1, limit));
  }

  list(options: ListOptions): { items: NormalizedCieLog[]; nextCursor: string | null } {
    const safeLimit = Math.min(200, Math.max(1, options.limit));
    const offset = Math.max(0, Number(options.cursor || 0) || 0);

    const source = this.logs.filter((l) =>
      (!options.type || l.type === options.type) && (!options.kind || l.event.kind === options.kind));
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

  /** Versão da v3: inclui os alarmes realmente ativos na central, além do histórico. */
  activeAlarmSnapshot(counters: CieCounters) {
    return {
      ...this.alarmSnapshot(counters),
      activeAlarms: this.active('alarme'),
    };
  }
}
