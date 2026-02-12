import { Request, Response } from 'express';
import { ok } from '../http/response';
import type { CieStateService } from '../services/cie-state.service';

export function healthCheck(_req: Request, res: Response, stateService: CieStateService) {
  const snap = stateService.getSnapshot();
  const status = snap.connected ? 'OK' : 'DEGRADED';

  return ok(res, {
    status: 'API Funcionando!',
    service: 'CIE2500',
    health: status,
    connected: snap.connected,
    reconnecting: snap.reconnecting,
    lastUpdated: snap.lastUpdated,
    lastError: snap.lastError,
  });
}

