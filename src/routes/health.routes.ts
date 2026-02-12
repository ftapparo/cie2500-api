import express from 'express';
import { healthCheck } from '../controllers/health.controller';
import { CieManager } from '../core/cie-manager';

export default (cieInstance: CieManager) => {

  const router = express.Router();

  // Rota de health check
  router.get('/health', (req, res) => healthCheck(req, res, cieInstance));

  // Rota de health check alternativa
  router.get('/healthcheck', (req, res) => healthCheck(req, res, cieInstance));
  return router;
};
