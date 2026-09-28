import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import type { CieManager } from '../core/cie-manager';
import { healthRoutes } from './health/health.routes';
import { cieRoutes } from './cie/cie.routes';
import { registerErrorHandler, responseHelpersPlugin } from './shared/reply-helpers';
import { registerServiceAuth } from './shared/service-auth';
import openapiDocument from './openapi.json';

/**
 * Bootstrap da v3 (Fastify + Zod). Roda num processo/porta própria,
 * lado a lado com a v2 (Express, exposta em /v1/api) — ambas chamam o
 * mesmo core/, nunca duplicam lógica de negócio nem abrem uma segunda
 * conexão com a central de incêndio (CieManager é instância única,
 * injetada aqui como na v2).
 *
 * Path público: /v3/api/*, em porta interna própria (PORT_V3), roteada
 * externamente por uma entrada dedicada no Cloudflare Tunnel quando
 * chegar a hora. O prefixo /v3 é convenção de nomenclatura com os
 * outros dois backends — este projeto expõe hoje /v1/api na v2, não
 * /v2/api.
 */
export async function StartWebServerV3(cieInstance: CieManager): Promise<void> {
    const app = Fastify({
        logger: false, // usamos console.log/error como o resto do projeto
    });

    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    // Mecanismo de resposta padrão da v3 (reply.ok()/reply.fail()) e
    // tratamento central de erro — ver src/v3/shared/response.ts para o
    // desenho completo do envelope.
    await app.register(responseHelpersPlugin);
    registerErrorHandler(app);

    // Autenticação de serviço: só a nova-api (rede interna) conhece
    // CIE_SERVICE_TOKEN e pode chamar estas rotas. Autorização por
    // usuário/role continua sendo decidida na nova-api antes de repassar
    // a chamada — ver src/v3/shared/service-auth.ts.
    registerServiceAuth(app);

    // Flag própria da v3. Spec escrito à mão em openapi.json, servido em
    // mode: 'static' — mesmo padrão de nova-api/nova-tag (ver
    // docs/PADRAO-RESPOSTA-V3.md).
    const swaggerV3Enabled = process.env.SWAGGER_V3_ENABLED === 'true';
    if (swaggerV3Enabled) {
        await app.register(fastifySwagger, {
            mode: 'static',
            specification: { document: openapiDocument as never },
        });

        await app.register(fastifySwaggerUi, {
            routePrefix: '/v3/swagger',
        });

        app.get('/v3/apispec_1.json', async (_request, reply) => {
            reply.header('Content-Type', 'application/json').send(openapiDocument);
        });
    }

    await app.register(async (instance) => {
        instance.withTypeProvider<ZodTypeProvider>();
        await healthRoutes(instance, cieInstance);
        await cieRoutes(instance, cieInstance);
    }, { prefix: '/v3/api' });

    const port = Number(process.env.PORT_V3 || 3031);

    try {
        await app.listen({ port, host: '0.0.0.0' });
        console.log(`[ApiV3] WebServer (Fastify) rodando na porta ${port}`);
    } catch (err) {
        console.error('[ApiV3] Falha ao iniciar o servidor Fastify:', err);
        throw err;
    }
}
