export type CieLogType = 'alarme' | 'falha' | 'supervisao' | 'operacao' | 'bloqueio';
export type CieEventType = CieLogType;
export type CieHistoricLogType = Exclude<CieLogType, 'bloqueio'>;

export type NormalizedCieLog = {
  key: string;
  type: CieLogType;
  id: number;
  zone: number | null;
  address: number | null;
  loop: number | null;
  deviceName: string | null;
  zoneName: string | null;
  eventType: number | null;
  blocked: boolean | null;
  occurredAt: string;
  raw: unknown;
  createdAt: number;
};

export type AlarmActiveSnapshot = {
  isTriggered: boolean;
  counters: {
    alarme: number;
    falha: number;
    supervisao: number;
    bloqueio: number;
  };
  latestAlarmLogs: NormalizedCieLog[];
};
