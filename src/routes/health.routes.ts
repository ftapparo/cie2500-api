import { Router } from 'express';
import { healthCheck } from '../controllers/health.controller';
import type { CieStateService } from '../services/cie-state.service';

export default function healthRoutes(stateService: CieStateService) {
  const router = Router();

  router.get('/health', (req, res) => healthCheck(req, res, stateService));
  router.get('/healthcheck', (req, res) => healthCheck(req, res, stateService));

  return router;
}

