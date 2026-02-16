import express from 'express';
import cors from 'cors';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from '../swagger.json';

import healthRoutes from '../routes/health.routes';
import cieRoutes from '../routes/cie.routes';
import { responseHandler } from '../middleware/response-handler';
import { CieManager } from '../core/cie-manager';
import { requestContextMiddleware } from '../middleware/request-context';


export async function StartWebServer(cieInstance: CieManager): Promise<void> {
    const app = express();
    const port = cieInstance.fireCentral.webserverPort;
    const server = http.createServer(app);

    /**
     * Middleware de CORS para permitir requisições de qualquer origem e métodos principais.
     */
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: '*',
        credentials: false
    }));

    /**
     * Middleware para tratar requisições OPTIONS (CORS Preflight).
     */
    app.options(/.*/, cors());

    /**
     * Middleware para parsear JSON nas requisições.
     */
    app.use(express.json());
    app.use(requestContextMiddleware);

    /**
     * Middleware para padronizar respostas da API.
     */
    app.use(responseHandler);

    /**
     * Registro das rotas principais da API.
     */
    app.use('/v1/api', healthRoutes(cieInstance));
    app.use('/v1/api', cieRoutes(cieInstance));

    /**
     * Rota para servir a documentação Swagger UI.
     */
    app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    /**
     * Endpoint para servir o arquivo swagger.json (OpenAPI spec).
     */
    app.get('/apispec_1.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerDocument);
    });

    /**
     * Middleware para tratar rotas não encontradas (404).
     */
    app.use((_req, res) => {
        res.status(404).send();
    });

    /**
     * Inicializa o servidor Express na porta configurada.
     */
    cieInstance.bindWebSocket(server);

    server.listen(port, () => {
        console.log(`[Api] WebServer rodando na porta ${port}`);
    });
}

