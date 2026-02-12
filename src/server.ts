import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json';
import healthRoutes from './routes/health.routes';
import cieRoutes from './routes/cie.routes';
import { CieClient } from './core/cie-client';
import { CieLogService } from './services/cie-log.service';
import { CieStateService } from './services/cie-state.service';
import { CieCommandService } from './services/cie-command.service';
import { CieWsBroker } from './ws/cie-ws-broker';

const PORT = Number(process.env.PORT || 4021);
const CIE_IP = process.env.CIE_IP || '192.168.0.4';
const CIE_PASSWORD = process.env.CIE_PASSWORD || '444444';
const CIE_ENDERECO = Number(process.env.CIE_ENDERECO ?? 0);
const CIE_POLL_MS = Number(process.env.CIE_POLL_MS || 4000);
const CIE_REQUEST_TIMEOUT_MS = Number(process.env.CIE_REQUEST_TIMEOUT_MS || 10000);
const CIE_LOG_BACKFILL_LIMIT = Number(process.env.CIE_LOG_BACKFILL_LIMIT || 50);
const CIE_LOG_RING_SIZE = Number(process.env.CIE_LOG_RING_SIZE || 1000);

const app = express();
const server = http.createServer(app);

const cieClient = new CieClient({
  ip: CIE_IP,
  password: CIE_PASSWORD,
  endereco: CIE_ENDERECO,
  timeoutMs: CIE_REQUEST_TIMEOUT_MS,
});
const cieLogService = new CieLogService(CIE_LOG_RING_SIZE);
const cieStateService = new CieStateService(cieClient, cieLogService, {
  pollMs: CIE_POLL_MS,
  logBackfillLimit: CIE_LOG_BACKFILL_LIMIT,
});
const cieCommandService = new CieCommandService(cieClient);
const wsBroker = new CieWsBroker(server, '/v2/ws');

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*',
  credentials: false,
}));
app.options(/.*/, cors());
app.use(express.json());

app.use('/v2/api', healthRoutes(cieStateService));
app.use('/v2/api', cieRoutes(cieStateService, cieLogService, cieCommandService));

app.use('/v2/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/v2/apispec_1.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocument);
});

app.use((_req, res) => {
  res.status(404).send();
});

cieStateService.on('connection.status.changed', (data) => {
  wsBroker.publish('connection.status.changed', data);
});
cieStateService.on('cie.status.updated', (data) => {
  wsBroker.publish('cie.status.updated', data);
});
cieStateService.on('cie.alarm.triggered', (data) => {
  wsBroker.publish('cie.alarm.triggered', data);
});
cieStateService.on('cie.log.received', (data) => {
  wsBroker.publish('cie.log.received', data);
});

async function bootstrap() {
  await cieStateService.start();
  server.listen(PORT, () => {
    console.log(`[CIE] Service listening on port ${PORT}`);
  });
}

async function shutdown(code = 0) {
  try {
    wsBroker.close();
    await cieStateService.stop();
  } catch {
    // ignore shutdown errors
  }

  server.close(() => process.exit(code));
}

process.on('SIGINT', () => { void shutdown(0); });
process.on('SIGTERM', () => { void shutdown(0); });
process.on('uncaughtException', (error) => {
  console.error('[CIE] uncaughtException', error);
  void shutdown(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CIE] unhandledRejection', reason);
  void shutdown(1);
});

void bootstrap().catch((error) => {
  console.error('[CIE] bootstrap error', error);
  process.exit(1);
});

