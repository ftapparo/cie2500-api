import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { CieManager } from '../../core/cie-manager';
import { successResponseSchema } from '../shared/response';

// Reaproveita o mesmo snapshot que a v2 usa (CieManager.getStateService()),
// health da v3 reflete o estado real da conexão com a central, não um
// valor fixo.
const healthDataSchema = z.object({
    status: z.literal('API Funcionando!'),
    service: z.literal('CIE2500'),
    health: z.enum(['OK', 'DEGRADED']),
    connected: z.boolean(),
    reconnecting: z.boolean(),
    lastUpdated: z.number().nullable(),
    lastError: z.string().nullable(),
});

export async function healthRoutes(app: FastifyInstance, cieInstance: CieManager) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    const schema = {
        response: {
            200: successResponseSchema(healthDataSchema),
        },
    };

    const respondHealth = (reply: FastifyReply) => {
        const snap = cieInstance.getStateService().getSnapshot();
        const health = snap.connected ? 'OK' as const : 'DEGRADED' as const;

        reply.ok(
            {
                status: 'API Funcionando!' as const,
                service: 'CIE2500' as const,
                health,
                connected: snap.connected,
                reconnecting: snap.reconnecting,
                lastUpdated: snap.lastUpdated,
                lastError: snap.lastError,
            },
            { status: snap.connected ? 200 : 503 },
        );
    };

    // Mesmo par de rotas de convenção usado em nova-api/nova-tag.
    typedApp.get('/health', { schema }, async (_request, reply) => {
        respondHealth(reply);
    });

    typedApp.get('/healthcheck', { schema }, async (_request, reply) => {
        respondHealth(reply);
    });
}
