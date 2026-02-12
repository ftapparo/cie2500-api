import { Request, Response } from 'express';
import { fail, ok } from '../http/response';
import type { CieStateService } from '../services/cie-state.service';
import type { CieLogService } from '../services/cie-log.service';
import type { CieCommandService, CommandAction } from '../services/cie-command.service';
import type { CieLogType } from '../types/logs';

const LOG_TYPES: CieLogType[] = ['alarme', 'falha', 'supervisao', 'operacao'];

function parseLimit(value: unknown, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(200, Math.floor(n));
}

export function getCieStatus(_req: Request, res: Response, stateService: CieStateService) {
  return ok(res, stateService.getSnapshot());
}

export function getActiveAlarms(_req: Request, res: Response, stateService: CieStateService, logService: CieLogService) {
  const snap = stateService.getSnapshot();
  const counters = {
    alarme: Number(snap.status?.status?.alarme || 0),
    falha: Number(snap.status?.status?.falha || 0),
    supervisao: Number(snap.status?.status?.supervisao || 0),
    bloqueio: Number(snap.status?.status?.bloqueio || 0),
  };
  return ok(res, logService.alarmSnapshot(counters));
}

export function listLogs(req: Request, res: Response, logService: CieLogService) {
  const type = req.query.type;
  if (typeof type === 'string' && !LOG_TYPES.includes(type as CieLogType)) {
    return fail(res, `Parâmetro type inválido. Use: ${LOG_TYPES.join(', ')}.`, 400);
  }

  const limit = parseLimit(req.query.limit, 50);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  const result = logService.list({
    type: typeof type === 'string' ? (type as CieLogType) : undefined,
    limit,
    cursor,
  });

  return ok(res, {
    type: typeof type === 'string' ? type : 'all',
    limit,
    cursor: cursor ?? null,
    nextCursor: result.nextCursor,
    items: result.items,
  });
}

export async function executeCommand(
  req: Request,
  res: Response,
  action: CommandAction,
  commandService: CieCommandService,
  stateService: CieStateService
) {
  try {
    const response = await commandService.execute(action);
    await stateService.refreshNow();
    return ok(res, {
      action,
      response,
      snapshot: stateService.getSnapshot(),
    });
  } catch (error: any) {
    return fail(res, error?.message || 'Falha ao executar comando.', Number(error?.status || 500), error);
  }
}

export async function reconnectConnection(_req: Request, res: Response, stateService: CieStateService) {
  try {
    await stateService.reconnectNow();
    return ok(res, {
      message: 'Reconexão executada com sucesso.',
      snapshot: stateService.getSnapshot(),
    });
  } catch (error: any) {
    return fail(res, 'Falha ao reconectar com a central.', 502, error?.message || error);
  }
}

