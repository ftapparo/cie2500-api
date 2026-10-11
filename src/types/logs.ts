export type CieLogType = 'alarme' | 'falha' | 'supervisao' | 'operacao' | 'bloqueio';
export type CieEventType = CieLogType;
export type CieHistoricLogType = Exclude<CieLogType, 'bloqueio'>;
// Canal de eventos ativos da central: não existe "operacao", e o índice 3 é bloqueio.
export type CieActiveType = Exclude<CieLogType, 'operacao'>;

// ativacao = algo começou (incêndio, falha nova); restauracao = algo voltou ao normal;
// estado = resumo do sistema ("Sistema em Falha"); informativo = registro sem ação.
export type CieEventKind = 'ativacao' | 'restauracao' | 'estado' | 'informativo';
export type CieEventSeverity = 'critical' | 'warning' | 'info' | 'ok';

export type CieEventInfo = {
  category: CieLogType;
  code: number | null;
  label: string;
  kind: CieEventKind;
  severity: CieEventSeverity;
};

// Local interpretado do nome do dispositivo, pela convenção de cadastro do
// condomínio: "16 ANDAR B T-B" = 16º andar, posição B no andar, torre B.
export type CiePlace = {
  tower: string | null;
  towerLabel: string | null;
  floor: number | null;
  floorLabel: string | null;
  position: string | null;
  positionLabel: string | null;
  area: string | null;
};

export type CieLogDisplay = {
  title: string;
  device: string | null;
  deviceName: string | null;
  place: CiePlace | null;
  loop: number | null;
  address: number | null;
  zone: number | null;
  zoneName: string | null;
};

export type CieDeviceClassification = {
  typeCode: number | null;
  subtypeCode: number | null;
  typeLabel: string | null;
  subtypeLabel: string | null;
  resolvedLabel: string | null;
  source: 'codes' | 'name' | 'none';
};

export type NormalizedCieLog = {
  key: string;
  type: CieLogType;
  id: number;
  zone: number | null;
  address: number | null;
  loop: number | null;
  deviceName: string | null;
  zoneName: string | null;
  deviceTypeCode: number | null;
  deviceTypeLabel: string | null;
  deviceClassification: CieDeviceClassification | null;
  eventType: number | null;
  blocked: boolean | null;
  occurredAt: string;
  raw: unknown;
  createdAt: number;
  source: 'historico' | 'ativo';
  event: CieEventInfo;
  display: CieLogDisplay;
  number: number | null;
  firstEvent: boolean | null;
  origin: number | null;
  repeater: number | null;
  historyTotal: number | null;
};

export type CieCounters = {
  alarme: number;
  falha: number;
  supervisao: number;
  bloqueio: number;
};

export type AlarmActiveSnapshot = {
  isTriggered: boolean;
  counters: CieCounters;
  latestAlarmLogs: NormalizedCieLog[];
};

export type CiePanelState = 'offline' | 'reiniciando' | 'alarme' | 'falha' | 'supervisao' | 'bloqueio' | 'normal';

export type CiePanelSituation = {
  state: CiePanelState;
  label: string;
  severity: CieEventSeverity;
  silenced: boolean;
};

export type CieActiveEvents = Record<CieActiveType, NormalizedCieLog[]>;
