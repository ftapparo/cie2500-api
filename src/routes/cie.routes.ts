import { Router } from 'express';
import {
  executeBlockCommand,
  executeCommand,
  executeOutputCommand,
  getActiveAlarms,
  getBlockCounters,
  getCieStatus,
  getOutputCounters,
  getPanelStatus,
  listLogsWithWarmupGuard,
  reconnectConnection,
} from '../controllers/cie.controller';
import type { CieManager } from '../core/cie-manager';

export default function cieRoutes(cieInstance: CieManager) {
  const router = Router();
  const stateService = cieInstance.getStateService();
  const logService = cieInstance.getLogService();
  const commandService = cieInstance.getCommandService();

  router.get('/cie/status', (req, res) => getCieStatus(req, res, stateService));
  router.get('/cie/panel', (req, res) => getPanelStatus(req, res, stateService, logService));
  router.get('/cie/alarms/active', (req, res) => getActiveAlarms(req, res, stateService, logService));
  router.get('/cie/logs', (req, res) => listLogsWithWarmupGuard(req, res, logService, stateService));
  router.get('/cie/counters/blocks', (req, res) => getBlockCounters(req, res, commandService));
  router.get('/cie/counters/outputs', (req, res) => getOutputCounters(req, res, commandService));

  router.post('/cie/commands/silence', (req, res) =>
    executeCommand(req, res, 'silence', commandService, stateService)
  );
  router.post('/cie/commands/release', (req, res) =>
    executeCommand(req, res, 'release', commandService, stateService)
  );
  router.post('/cie/commands/restart', (req, res) =>
    executeCommand(req, res, 'restart', commandService, stateService)
  );
  router.post('/cie/commands/brigade-siren', (req, res) =>
    executeCommand(req, res, 'brigade-siren', commandService, stateService)
  );
  router.post('/cie/commands/alarm-general', (req, res) =>
    executeCommand(req, res, 'alarm-general', commandService, stateService)
  );
  router.post('/cie/commands/delay-siren', (req, res) =>
    executeCommand(req, res, 'delay-siren', commandService, stateService)
  );
  router.post('/cie/commands/silence-bip', (req, res) =>
    executeCommand(req, res, 'silence-bip', commandService, stateService)
  );
  router.post('/cie/commands/silence-siren', (req, res) =>
    executeCommand(req, res, 'silence-siren', commandService, stateService)
  );
  router.post('/cie/commands/block', (req, res) =>
    executeBlockCommand(req, res, commandService, stateService)
  );
  router.post('/cie/commands/output', (req, res) =>
    executeOutputCommand(req, res, commandService, stateService)
  );

  router.post('/cie/connection/reconnect', (req, res) => reconnectConnection(req, res, stateService));

  return router;
}
