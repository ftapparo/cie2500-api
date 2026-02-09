import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

import { CIE2500Native } from './native/CIE2500Native';
import type { NomeModelo, Mac, Info, Status, DataHora } from './types/cie';

const PORT        = Number(process.env.PORT || 3000);
const CIE_IP      = process.env.CIE_IP || '192.168.0.4';
const CIE_PASS    = process.env.CIE_PASSWORD || '444444';
const CIE_END     = Number(process.env.CIE_ENDERECO ?? 0);
const POLL_MS     = Number(process.env.POLL_MS || 3000);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const cie = new CIE2500Native();

// ------- Estado em memória -------
type CentralSnapshot = {
  connected: boolean;
  nomeModelo?: NomeModelo;
  mac?: Mac;
  info?: Info;
  dataHora?: DataHora;
  status?: Status;
  lastUpdated?: number; // epoch ms
  lastError?: string | null;
};

let snap: CentralSnapshot = {
  connected: false,
  lastError: null,
};

let pollTimer;
let reconnecting = false;

// ------- Funções utilitárias -------
async function initialFetch() {
  // Busca um “pacote” inicial de dados após conectar
  const [nomeModelo, mac, info, dataHora, status] = await Promise.all([
    cie.nomeModelo(CIE_IP, CIE_END),
    cie.mac(CIE_IP, CIE_END),
    cie.info(CIE_IP, CIE_END),
    cie.dataHora(CIE_IP, CIE_END),
    cie.status(CIE_IP, CIE_END),
  ]);

  snap = {
    ...snap,
    connected: true,
    nomeModelo, mac, info, dataHora, status,
    lastUpdated: Date.now(),
    lastError: null,
  };
}

async function pollOnce() {
  try {
    const [status, dataHora] = await Promise.all([
      cie.status(CIE_IP, CIE_END),
      cie.dataHora(CIE_IP, CIE_END),
    ]);
    snap.status = status;
    snap.dataHora = dataHora;
    snap.lastUpdated = Date.now();
    snap.connected = true;
    snap.lastError = null;
  } catch (e: any) {
    snap.lastError = e?.message || String(e);
    // força reconexão assíncrona
    triggerReconnect();
  }
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(pollOnce, POLL_MS);
  // se quiser permitir o processo encerrar mesmo com o timer:
  // (pollTimer as any).unref?.();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function connectFlow() {
  // Descoberta opcional (ajuda a sincronizar counters de cifra):
  try { await cie.discover(true); } catch {}
  const token = await cie.authenticate(CIE_IP, CIE_PASS, CIE_END);
  await cie.startCommunication(CIE_IP, CIE_END, token);
  await initialFetch();
}

async function reconnectFlow() {
  if (reconnecting) return;
  reconnecting = true;
  try {
    await cie.stopCommunication();
  } catch {}
  try {
    await connectFlow();
  } catch (e: any) {
    snap.connected = false;
    snap.lastError = e?.message || String(e);
  } finally {
    reconnecting = false;
  }
}

function triggerReconnect() {
  // agenda reconexão sem empilhar várias
  if (!reconnecting) {
    void reconnectFlow();
  }
}

// ------- Bootstrap -------
async function main() {
  try {
    await connectFlow();
    startPolling();
    console.log('[cie] conectado e em polling…');
  } catch (e: any) {
    snap.connected = false;
    snap.lastError = e?.message || String(e);
    console.error('[cie] falha ao conectar inicialmente:', snap.lastError);
    // tenta reconectar em background
    triggerReconnect();
  }

  server.listen(PORT, () => {
    console.log(`[server] http://localhost:${PORT}`);
  });
}

// ------- Rotas -------
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    connected: snap.connected,
    lastUpdated: snap.lastUpdated ?? null,
    lastError: snap.lastError ?? null,
  });
});

app.get('/cie/info', (_req, res) => {
  // retorna snapshot agregado da central
  res.json({
    connected: snap.connected,
    nomeModelo: snap.nomeModelo ?? null,
    mac: snap.mac ?? null,
    info: snap.info ?? null,
    dataHora: snap.dataHora ?? null,
    status: snap.status ?? null,
    lastUpdated: snap.lastUpdated ?? null,
    lastError: snap.lastError ?? null,
  });
});

// (Futuro) exemplos de rotas para comandos (ativar saída, bloquear, etc.)
// app.post('/cie/outputs/:laco/:numero', async (req, res) => { … });


// ------- Encerramento gracioso -------
async function shutdown(code = 0) {
  try {
    stopPolling();
    await cie.shutdown();
  } catch (e) {}
  server.close(() => process.exit(code));
}

process.on('SIGINT',  () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

void main();
