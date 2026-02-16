import type { DataHora, Info, Mac, NomeModelo, Status } from './cie';

export type CieStateSnapshot = {
  connected: boolean;
  restartingUntil: number | null;
  nomeModelo: NomeModelo | null;
  mac: Mac | null;
  info: Info | null;
  dataHora: DataHora | null;
  status: Status | null;
  lastUpdated: number | null;
  lastError: string | null;
  reconnecting: boolean;
  reconnectAttempt: number;
};
