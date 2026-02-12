import { Request, Response } from 'express';
import type { CieManager } from '../core/cie-manager';

export const healthCheck = (_req: Request, res: Response, cieInstance: CieManager) => {
  const snap = cieInstance.getStateService().getSnapshot();
  const status = snap.connected ? 'OK' : 'DEGRADED';

  return res.ok({
    status: 'API Funcionando!',
    service: 'CIE2500',
    health: status,
    connected: snap.connected,
    reconnecting: snap.reconnecting,
    lastUpdated: snap.lastUpdated,
    lastError: snap.lastError,
  });
};
