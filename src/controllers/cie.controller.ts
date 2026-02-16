import { Request, Response } from 'express';
import type { CieStateService } from '../services/cie-state.service';
import type { CieLogService } from '../services/cie-log.service';
import type { CieCommandService, CommandAction } from '../services/cie-command.service';
import type { CieLogType } from '../types/logs';
import { trimNulls } from '../utils';

const LOG_TYPES: CieLogType[] = ['alarme', 'falha', 'supervisao', 'operacao', 'bloqueio'];

function parseLimit(value: unknown, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(200, Math.floor(n));
}

function parseIntField(value: unknown, field: string, min?: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Campo '${field}' invalido.`);
  }
  const parsed = Math.floor(n);
  if (typeof min === 'number' && parsed < min) {
    throw new Error(`Campo '${field}' deve ser >= ${min}.`);
  }
  return parsed;
}

export function getCieStatus(_req: Request, res: Response, stateService: CieStateService) {
  return res.ok(stateService.getSnapshot());
}

export function getPanelStatus(_req: Request, res: Response, stateService: CieStateService, logService: CieLogService) {
  const snapshot = stateService.getSnapshot();
  const latestFailureEvent = logService.latestByType('falha', 1)[0] ?? null;
  const restartingUntil = Number(snapshot.restartingUntil || 0);
  const restarting = Number.isFinite(restartingUntil) && restartingUntil > Date.now();

  return res.ok({
    online: snapshot.connected,
    connected: snapshot.connected,
    restarting,
    restartingUntil: restarting ? restartingUntil : null,
    reconnecting: snapshot.reconnecting,
    reconnectAttempt: snapshot.reconnectAttempt,
    lastError: snapshot.lastError,
    lastUpdated: snapshot.lastUpdated,
    central: {
      ip: process.env.CIE_IP ?? null,
      endereco: Number(process.env.CIE_ENDERECO ?? 0),
      nome: typeof snapshot.nomeModelo?.nome === 'string' ? trimNulls(snapshot.nomeModelo.nome) : null,
      modelo: snapshot.nomeModelo?.modelo ?? null,
      mac: snapshot.mac?.mac ?? null,
    },
    dataHora: snapshot.dataHora,
    counters: snapshot.status?.status ?? null,
    leds: snapshot.status?.leds ?? null,
    latestFailureEvent,
  });
}

export function getActiveAlarms(_req: Request, res: Response, stateService: CieStateService, logService: CieLogService) {
  const snap = stateService.getSnapshot();
  const counters = {
    alarme: Number(snap.status?.status?.alarme || 0),
    falha: Number(snap.status?.status?.falha || 0),
    supervisao: Number(snap.status?.status?.supervisao || 0),
    bloqueio: Number(snap.status?.status?.bloqueio || 0),
  };
  return res.ok(logService.alarmSnapshot(counters));
}

export function listLogs(req: Request, res: Response, logService: CieLogService) {
  const type = req.query.type;
  if (typeof type === 'string' && !LOG_TYPES.includes(type as CieLogType)) {
    return res.fail(`Parametro type invalido. Use: ${LOG_TYPES.join(', ')}.`, 400);
  }

  const limit = parseLimit(req.query.limit, 50);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  const result = logService.list({
    type: typeof type === 'string' ? (type as CieLogType) : undefined,
    limit,
    cursor,
  });

  return res.ok({
    type: typeof type === 'string' ? type : 'all',
    limit,
    cursor: cursor ?? null,
    nextCursor: result.nextCursor,
    items: result.items,
  });
}

export async function listLogsWithWarmupGuard(
  req: Request,
  res: Response,
  logService: CieLogService,
  stateService: CieStateService
) {
  const type = req.query.type;
  const limit = parseLimit(req.query.limit, 50);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  if (!cursor && typeof type === 'string' && LOG_TYPES.includes(type as CieLogType)) {
    await stateService.ensureLogs(type as CieLogType, limit);
  } else if (!cursor && stateService.isWarmingUp()) {
    await stateService.waitForWarmup(12000);
  }

  return listLogs(req, res, logService);
}

export async function getBlockCounters(_req: Request, res: Response, commandService: CieCommandService) {
  try {
    const counters = await commandService.getBlockCounters();
    return res.ok(counters);
  } catch (error: any) {
    return res.fail('Falha ao consultar contadores de bloqueio.', Number(error?.status || 500), error);
  }
}

export async function getOutputCounters(_req: Request, res: Response, commandService: CieCommandService) {
  try {
    const counters = await commandService.getOutputCounters();
    return res.ok(counters);
  } catch (error: any) {
    return res.fail('Falha ao consultar contadores de saida.', Number(error?.status || 500), error);
  }
}

export async function executeCommand(
  _req: Request,
  res: Response,
  action: CommandAction,
  commandService: CieCommandService,
  stateService: CieStateService
) {
  const isRestartCommand = action === 'restart';

  try {
    const response = await commandService.execute(action);
    const buttonStatus = String((response as any)?.resposta || '');
    if (buttonStatus && buttonStatus !== 'StatusBotaoOk' && buttonStatus !== 'StatusBotaoWaiting') {
      const error = new Error(`Comando rejeitado pela central: ${buttonStatus}`);
      (error as any).status = 409;
      throw error;
    }

    if (isRestartCommand) {
      stateService.markRestarting(60000);
    } else {
      await stateService.refreshNow();
    }

    return res.ok({
      action,
      response,
      snapshot: stateService.getSnapshot(),
    });
  } catch (error: any) {
    return res.fail(error?.message || 'Falha ao executar comando.', Number(error?.status || 500), error);
  }
}

export async function executeBlockCommand(
  req: Request,
  res: Response,
  commandService: CieCommandService,
  stateService: CieStateService
) {
  try {
    const payload = {
      tipoBloqueio: parseIntField(req.body?.tipoBloqueio, 'tipoBloqueio', 0),
      laco: parseIntField(req.body?.laco, 'laco', 0),
      numero: parseIntField(req.body?.numero, 'numero', 0),
      bloquear: parseIntField(req.body?.bloquear, 'bloquear', 0),
    };

    if (![0, 1].includes(payload.bloquear)) {
      return res.fail("Campo 'bloquear' deve ser 0 (desbloquear) ou 1 (bloquear).", 400);
    }

    const response = await commandService.executeBlockCommand(payload);
    await stateService.refreshNow();

    return res.ok({
      action: 'block',
      payload,
      response,
      snapshot: stateService.getSnapshot(),
    });
  } catch (error: any) {
    const message = error?.message || 'Falha ao executar comando de bloqueio.';
    const status = message.includes("Campo '") ? 400 : Number(error?.status || 500);
    return res.fail(message, status, error);
  }
}

export async function executeOutputCommand(
  req: Request,
  res: Response,
  commandService: CieCommandService,
  stateService: CieStateService
) {
  try {
    const payload = {
      laco: parseIntField(req.body?.laco, 'laco', 0),
      numero: parseIntField(req.body?.numero, 'numero', 0),
      ativo: parseIntField(req.body?.ativo, 'ativo', 0),
    };

    if (![0, 1].includes(payload.ativo)) {
      return res.fail("Campo 'ativo' deve ser 0 (desativar) ou 1 (ativar).", 400);
    }

    const response = await commandService.executeOutputCommand(payload);
    await stateService.refreshNow();

    return res.ok({
      action: 'output',
      payload,
      response,
      snapshot: stateService.getSnapshot(),
    });
  } catch (error: any) {
    const message = error?.message || 'Falha ao executar comando de saida.';
    const status = message.includes("Campo '") ? 400 : Number(error?.status || 500);
    return res.fail(message, status, error);
  }
}

export async function reconnectConnection(_req: Request, res: Response, stateService: CieStateService) {
  try {
    await stateService.reconnectNow();
    return res.ok({
      message: 'Reconexao executada com sucesso.',
      snapshot: stateService.getSnapshot(),
    });
  } catch (error: any) {
    return res.fail('Falha ao reconectar com a central.', 502, error?.message || error);
  }
}
