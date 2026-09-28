import dotenv from 'dotenv';
import { CieManager } from './core/cie-manager';
import { StartWebServer } from './v2/api/web-server.api';
import { StartWebServerV3 } from './v3/server';

const dotenvResult = dotenv.config();
if (dotenvResult.error) {
  console.warn('[Server] .env nao carregado (ok em Docker)');
} else {
  console.log('[Server] .env carregado com sucesso');
}

async function startService(): Promise<void> {
  process.on('uncaughtException', (err) => {
    console.error('[Server] uncaughtException', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (err) => {
    console.error('[Server] unhandledRejection', err);
    process.exit(1);
  });

  const port = Number(process.env.PORT || 4021);
  let cieInstance: CieManager | null = null;

  try {
    cieInstance = new CieManager({
      name: 'CIE2500',
      webserverPort: port,
    });

    // Inicia o servidor web e a conexão com a CIE em paralelo
    await StartWebServer(cieInstance);

    // v3 (Fastify) — roda lado a lado da v2, porta propria, ainda em
    // construcao. Falha aqui nao deve derrubar a v2, que ja atende
    // producao.
    try {
      await StartWebServerV3(cieInstance);
      console.log('[Server] WebServer v3 inicializado.');
    } catch (v3Err) {
      console.error('[Server] Falha ao iniciar a v3 (nao fatal, v2 segue operando):', v3Err);
    }

    void cieInstance.connectToCie()
      .then(() => {
        console.log(`[Server] Conectado a CIE (${cieInstance?.fireCentral.name})`);
      })
      .catch((error) => {
        console.error('[Server] Falha na conexao inicial com a CIE:', error);
      });
  } catch (err) {
    console.error('[Server] Erro na inicializacao:', err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    console.log(`[Server] Recebido ${signal}, finalizando...`);
    try {
      await cieInstance?.shutdown();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => { void shutdown('SIGINT'); });
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
}

void startService();
