import { Router } from 'express';
import {
  executeCommand,
  getActiveAlarms,
  getCieStatus,
  listLogs,
  reconnectConnection,
} from '../controllers/cie.controller';
import type { CieStateService } from '../services/cie-state.service';
import type { CieLogService } from '../services/cie-log.service';
import type { CieCommandService } from '../services/cie-command.service';

export default function cieRoutes(
  stateService: CieStateService,
  logService: CieLogService,
  commandService: CieCommandService
) {
  const router = Router();

  router.get('/cie/status', (req, res) => getCieStatus(req, res, stateService));
  router.get('/cie/alarms/active', (req, res) => getActiveAlarms(req, res, stateService, logService));
  router.get('/cie/logs', (req, res) => listLogs(req, res, logService));

  router.post('/cie/commands/silence', (req, res) =>
    executeCommand(req, res, 'silence', commandService, stateService)
  );
  router.post('/cie/commands/release', (req, res) =>
    executeCommand(req, res, 'release', commandService, stateService)
  );
  router.post('/cie/commands/restart', (req, res) =>
    executeCommand(req, res, 'restart', commandService, stateService)
  );

  router.post('/cie/connection/reconnect', (req, res) => reconnectConnection(req, res, stateService));

  return router;
}

