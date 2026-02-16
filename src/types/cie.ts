// src/types/cie.ts
export interface NomeModelo {
  endereco: number;
  nome: string;
  modelo: string; // "CIE2500" ou outros
}

export interface Mac { mac: string }

export interface Info {
  dispositivoLaco0: number; dispositivoLaco1: number; dispositivoLaco2: number;
  saidaLaco0: number;       saidaLaco1: number;       saidaLaco2: number;
  sireneLaco0: number;      sireneLaco1: number;      sireneLaco2: number;
  atuadorLaco0: number;     atuadorLaco1: number;     atuadorLaco2: number;
  regra: number; zona: number;
}

export interface BlockCounters {
  dispositivo: number;
  sirene: number;
  saida: number;
  atuador: number;
  regra: number;
  zona: number;
  laco: number;
  dispositivoLaco0: number;
  dispositivoLaco1: number;
  dispositivoLaco2: number;
  saidaLaco0: number;
  saidaLaco1: number;
  saidaLaco2: number;
  sireneLaco0: number;
  sireneLaco1: number;
  sireneLaco2: number;
  atuadorLaco0: number;
  atuadorLaco1: number;
  atuadorLaco2: number;
}

export interface OutputCounters {
  saidaLaco0: number;
  saidaLaco1: number;
  saidaLaco2: number;
  sireneLaco0: number;
  sireneLaco1: number;
  sireneLaco2: number;
  atuadorLaco0: number;
  atuadorLaco1: number;
  atuadorLaco2: number;
  saida: number;
  sirene: number;
  atuador: number;
}

export interface Status {
  status: {
    alarme: number; falha: number; supervisao: number; bloqueio: number; regrasTemporizando: number;
  };
  leds: Record<string, boolean>;
}

export interface DataHora {
  timestamp: number;     // ms desde 1970 (correto)
  utc: string;           // ISO corrigido a partir do timestamp
  local: string;         // string amigável na timezone local
}
