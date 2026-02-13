import dotenv from 'dotenv';
import { CieManager } from './core/cie-manager';
import { StartWebServer } from './api/web-server.api';

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

    await StartWebServer(cieInstance);
    console.log(`[Server] WebServer ativo na porta ${port}`);

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
