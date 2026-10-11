import { trimNulls } from '../utils';
import type {
  CieCounters,
  CieDeviceClassification,
  CieEventInfo,
  CieEventKind,
  CieEventSeverity,
  CieLogType,
  CiePanelSituation,
  CiePlace,
} from '../../types/logs';

// Textos e códigos copiados do software ProgramadorCIE da Intelbras
// (src/intelbras/ProgramadorCIE/www/js/app.js: TIPOS_EVENTO + traduções pt_br).
// O código só tem significado junto da categoria: Alarme 1 é incêndio,
// Falha 1 é "Dispositivo Inconsistente".

type CodeEntry = [label: string, kind: CieEventKind, severity: CieEventSeverity];

const ALARME: CodeEntry[] = [
  ['Nenhum Alarme', 'estado', 'ok'],
  ['Alarme', 'ativacao', 'critical'],
  ['Reset de Alarme', 'restauracao', 'ok'],
  ['Saída Confirmada', 'informativo', 'warning'],
  ['Saída Desativada', 'informativo', 'warning'],
  ['IO Restaurada', 'restauracao', 'ok'],
  ['Sistema em Alarme', 'estado', 'critical'],
];

const SUPERVISAO: CodeEntry[] = [
  ['Nenhuma Supervisão', 'estado', 'ok'],
  ['Supervisão', 'ativacao', 'warning'],
  ['Reset de Supervisão', 'restauracao', 'ok'],
  ['Sistema em Supervisão', 'estado', 'warning'],
];

const FALHA_LABELS = [
  'Falhas Restauradas',
  'Dispositivo Inconsistente',
  'Dispositivo Não Configurado',
  'Saída Padrão Falha Não Configurada',
  'Saída Padrão Alarme Não Configurada',
  'Saída Padrão Sup. Não Configurada',
  'Limpar Sensor de Fumaça',
  'Disp. em Falha',
  'Disp. em Falha Saída Padrão Alarme',
  'Disp. em Falha Saída Padrão Falha',
  'Disp. em Falha Saída Padrão Sup.',
  'Falta de Energia AC',
  'Sobretensão Fonte',
  'Subtensão Fonte',
  'Fuga Terra Negativa',
  'Fuga Terra Positiva',
  'Saída Carregador Reserva Abaixo de 0.9V',
  'Desconexão Fonte de Energia Reserva',
  'Sem Alimentação Bateria Insuficiente',
  'Falha de Sistema Comunicação Placa Laço',
  'Falha de Sistema Comunicação Fonte',
  'Falha de Sistema Memória Corrompida',
  'Falha de Sistema Firmware Corrompido',
  'Falha de Sistema Memória Laço Corrompida',
  'Config. Inconsistente Conecte o Computador',
  'Falha Comunicação Dispositivo',
  'Falha Comunicação Saída Padrão Alarme',
  'Falha Comunicação Saída Padrão Falha',
  'Falha Comunicação Saída Padrão Sup.',
  'Circuito Geral Aberto Dispositivo Saída Laço',
  'Circuito Aberto Saída Padrão Alarme',
  'Circuito Aberto Saída Padrão Falha',
  'Circuito Aberto Saída Padrão Sup.',
  'Curto-Circuito Saída Padrão Alarme',
  'Curto-Circuito Saída Padrão Falha',
  'Curto-Circuito Saída Padrão Sup.',
  'Falha Acionamento Saída',
  'Falha no Sistema',
  'Dados Inconsistentes',
  'Falha Restaurada',
  'Sistema em Falha',
  'Falha Bateria',
  'Fonte Inicializando',
  'Laço em Falha',
  'Falha Acionamento Saída Padrão Alarme',
  'Falha Acionamento Saída Padrão Falha',
  'Falha Acionamento Saída Padrão Sup.',
  'Falha de Comunicação com a Repetidora',
  'Falha de Comunicação com a Repetidora - Versão incompatível',
  'Falha Comunicação com a Central',
  'Falha Bateria Externa',
  'Falha Comunicação na Interligação',
  'Falha Comunicação Coord. Versão diferente',
];

const FALHA_RESTORE = new Set([0, 39]);
const FALHA_STATE = new Set([40]);
const FALHA_INFO = new Set([42]);

const FALHA: CodeEntry[] = FALHA_LABELS.map((label, code) => {
  if (FALHA_RESTORE.has(code)) return [label, 'restauracao', 'ok'];
  if (FALHA_STATE.has(code)) return [label, 'estado', 'warning'];
  if (FALHA_INFO.has(code)) return [label, 'informativo', 'info'];
  return [label, 'ativacao', 'warning'];
});

const OPERACAO_LABELS = [
  'Operação',
  'Reset Operação',
  'Central Silenciada',
  'Sirene Silenciada',
  'Reativação Sirene',
  'Acesso Nível 2',
  'Acesso Nível 3',
  'Acesso Nível 4',
  'Regra Adiada',
  'Central Reiniciada',
  'Sistema Iniciado',
  'Bloqueio Realizado',
  'Conexão PC',
  'Relógio Ajustado',
  'Botão Sirene Brigada',
  'Botão Alarme Geral',
  'Regra Atendida',
  'Evento Desconhecido',
  'Retardo Cancelado',
  'Evento em Temp.',
  '1/2 Regra Dupla',
  'Regra Não Config.',
  'Disp. Não Config.',
  'Zona Não Config.',
  'Botão Silenciar S.',
  'Startup Executado',
  'Tempo Máximo Retardo',
  'Falha Restaurada',
  'Disp. Bloqueado',
  'Disp. Desbloqueado',
  'Disp. Ativado',
  'Disp. Desativado',
  'Central Atualizada',
  'Erro Atualização',
  'Regra Temporizando',
  'Acionamento Regra Bloq.',
  'Regra Bloqueada',
  'Regra Desbloqueada',
  'Zona Bloqueada',
  'Zona Desbloqueada',
  'Laço Bloqueado',
  'Laço Desbloqueado',
  'Senhas Resetadas',
  'Disp. Removido',
  'Disp. Inserido',
  'Erro Comunicação Fonte',
  'Laço Registrado',
  'Configuração Padrão',
  '2/2 Regra Dupla',
  'Regra Acionada',
  'Gravar/Ler Disp.',
  'Tempo Retardo Conf.',
  'Regra Acionada Man.',
  'Novo Modelo Central',
  'Dados Sistema Alterado',
  'Senha Nivel2 Alterada',
  'Senha Nivel3 Alterada',
  'Senha Nivel4 Alterada',
  'Sistema com Falha de Falta de Energia',
  'Sistema em Pré Alarme',
  'Operação Remota Programador',
];

// Operações que merecem destaque: acionamentos manuais de sirene/alarme,
// reinício da central e estados de pré-alarme/falta de energia.
const OPERACAO_WARNING = new Set([9, 14, 15]);
const OPERACAO_STATE = new Set([58, 59]);

const OPERACAO: CodeEntry[] = OPERACAO_LABELS.map((label, code) => {
  if (OPERACAO_STATE.has(code)) return [label, 'estado', 'warning'];
  if (OPERACAO_WARNING.has(code)) return [label, 'informativo', 'warning'];
  return [label, 'informativo', 'info'];
});

const EVENT_CODES: Record<Exclude<CieLogType, 'bloqueio'>, CodeEntry[]> = {
  alarme: ALARME,
  supervisao: SUPERVISAO,
  falha: FALHA,
  operacao: OPERACAO,
};

export function describeEvent(category: CieLogType, code: number | null): CieEventInfo {
  // O SDK não traz tabela de códigos para o canal de bloqueios ativos.
  if (category === 'bloqueio') {
    return { category, code, label: 'Bloqueio ativo', kind: 'estado', severity: 'warning' };
  }

  const entry = code !== null ? EVENT_CODES[category][code] : undefined;
  if (!entry) {
    const label = code !== null ? `Evento desconhecido (código ${code})` : 'Evento desconhecido';
    return { category, code, label, kind: 'informativo', severity: 'info' };
  }

  const [label, kind, severity] = entry;
  return { category, code, label, kind, severity };
}

// Tipo 11 não existe no configurador, mas a central o usa nos logs reais
// para a fonte de alimentação (ex.: Falha 11 "Falta de Energia AC").
const DEVICE_TYPE_LABELS: Record<number, string> = {
  1: 'Sensor de Fumaça',
  2: 'Sensor de Temperatura',
  3: 'Acionador Manual',
  4: 'Módulo de Zona',
  5: 'Módulo de Entrada',
  9: 'Módulo de Entrada/Saída',
  10: 'Sinalizador Audiovisual',
  11: 'Alimentação',
  12: 'Saída Local',
};

const DEVICE_SUBTYPE_LABELS: Record<number, string> = {
  1: 'Sensor de Fumaça',
  2: 'Sensor de Temperatura',
  3: 'Acionador Manual',
  4: 'Módulo de Zona',
  5: 'Entrada sem controle de alimentação',
  6: 'Entrada com controle de alimentação',
  7: 'Sirene Convencional',
  8: 'Saída com confirmação',
  9: 'Saída sem confirmação',
  10: 'Sinalizador Audiovisual',
  11: 'Entrada local',
  12: 'Saída Local',
  13: 'Sirene com confirmação',
};

function inferByName(deviceName: string | null): string | null {
  if (!deviceName) return null;
  const normalized = trimNulls(deviceName).trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('fuma')) return 'Sensor de Fumaça';
  if (normalized.includes('temper')) return 'Sensor de Temperatura';
  if (normalized.includes('acionador') || normalized.includes('botoeira')) return 'Acionador Manual';
  if (normalized.includes('sirene')) return 'Sirene';
  if (normalized.includes('aliment')) return 'Alimentação';
  if (normalized.includes('saída local') || normalized.includes('saida local')) return 'Saída Local';
  if (normalized.includes('modulo') || normalized.includes('módulo')) return 'Módulo';
  return null;
}

export function describeDevice(
  typeCode: number | null,
  subtypeCode: number | null,
  deviceName: string | null,
): CieDeviceClassification | null {
  const typeLabel = typeCode !== null ? (DEVICE_TYPE_LABELS[typeCode] ?? null) : null;
  // Pelo UDP o subtipo chega com só 3 bits (config.js eventsUdp.device_subtype),
  // então valores 8–13 não são representáveis: o tipo sempre tem prioridade.
  const subtypeLabel = subtypeCode ? (DEVICE_SUBTYPE_LABELS[subtypeCode] ?? null) : null;
  const inferred = inferByName(deviceName);
  const resolvedLabel = typeLabel || inferred || subtypeLabel || null;

  if (typeCode === null && subtypeCode === null && !resolvedLabel) return null;

  return {
    typeCode,
    subtypeCode,
    typeLabel,
    subtypeLabel,
    resolvedLabel,
    source: typeLabel ? 'codes' : (inferred ? 'name' : (subtypeLabel ? 'codes' : 'none')),
  };
}

// Convenção de nomes cadastrada na central do condomínio:
//   "16 ANDAR B T-B" → 16º andar, posição B no andar (A, B ou C), torre B
//   "TERREO T-A"     → térreo da torre A
//   "PRESSURIZA T-C" → pressurização da torre C
//   "TORRE A"        → nome de regra (operações)
// Fora da convenção ("ELEVADOR 1", "Saída Local S2") não há local: null.
const FLOOR_RE = /^(\d{1,2})\s*ANDAR\s*([ABC])\s*T-?([ABC])$/i;
const GROUND_RE = /^T[ÉE]RREO\s*T-?([ABC])$/i;
const PRESSURE_RE = /^PRESSURIZA\S*\s*T-?([ABC])$/i;
const TOWER_RE = /^TORRE\s*([ABC])$/i;

function place(tower: string | null, floor: number | null, position: string | null, area: string | null): CiePlace {
  const t = tower?.toUpperCase() ?? null;
  const p = position?.toUpperCase() ?? null;
  return {
    tower: t,
    towerLabel: t ? `Torre ${t}` : null,
    floor,
    floorLabel: floor === null ? null : (floor === 0 ? 'Térreo' : `${floor}º andar`),
    position: p,
    positionLabel: p ? `Posição ${p}` : null,
    area,
  };
}

export function parsePlace(deviceName: string | null): CiePlace | null {
  const name = deviceName?.trim();
  if (!name) return null;

  let m = name.match(FLOOR_RE);
  if (m) return place(m[3], Number(m[1]), m[2], null);
  m = name.match(GROUND_RE);
  if (m) return place(m[1], 0, null, null);
  m = name.match(PRESSURE_RE);
  if (m) return place(m[1], null, null, 'Pressurização');
  m = name.match(TOWER_RE);
  if (m) return place(m[1], null, null, null);
  return null;
}

type SituationInput = {
  connected: boolean;
  restarting: boolean;
  counters: CieCounters | null;
  leds: Record<string, boolean> | null;
};

// Prioridade de exibição: o pior estado presente vence.
export function describePanelSituation(input: SituationInput): CiePanelSituation {
  const leds = input.leds ?? {};
  const silenced = leds.centralSilenciada === true || leds.sireneSilenciada === true;
  const counters = input.counters;

  if (input.restarting) return { state: 'reiniciando', label: 'Central reiniciando', severity: 'info', silenced };
  if (!input.connected || !counters) {
    return { state: 'offline', label: 'Central sem comunicação', severity: 'critical', silenced };
  }
  if (counters.alarme > 0) return { state: 'alarme', label: 'Sistema em alarme', severity: 'critical', silenced };
  if (counters.falha > 0) return { state: 'falha', label: 'Sistema em falha', severity: 'warning', silenced };
  if (counters.supervisao > 0) {
    return { state: 'supervisao', label: 'Sistema em supervisão', severity: 'warning', silenced };
  }
  if (counters.bloqueio > 0) {
    const plural = counters.bloqueio > 1 ? 'bloqueios ativos' : 'bloqueio ativo';
    return { state: 'bloqueio', label: `Sistema normal com ${counters.bloqueio} ${plural}`, severity: 'info', silenced };
  }
  return { state: 'normal', label: 'Sistema normal', severity: 'ok', silenced };
}
