import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// =============================================================================
// Autenticação de serviço (não de usuário final). O CIE nunca é exposto à
// internet — só a nova-api (na rede interna) chama estas rotas, atuando
// como gateway/proxy para o app mobile e o painel. O CIE não conhece o
// usuário final nem seus papéis; isso é decidido pela nova-api antes de
// repassar a chamada. O CIE só verifica que a chamada partiu de uma
// origem que conhece o segredo compartilhado CIE_SERVICE_TOKEN.
//
// Autorização por usuário/role continua sendo responsabilidade exclusiva
// da nova-api (bloco 2.2 do checklist, ainda não implementado) — este
// mecanismo não substitui isso.
// =============================================================================

const extractToken = (request: FastifyRequest): string | null => {
    const header = request.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
        return header.slice('Bearer '.length).trim();
    }
    return null;
};

export function registerServiceAuth(app: FastifyInstance) {
    const expectedToken = process.env.CIE_SERVICE_TOKEN;

    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        // Healthcheck fica público — monitoramento (Docker healthcheck,
        // uptime checks) não deve depender de segredo.
        if (request.url.startsWith('/v3/api/health')) {
            return;
        }

        if (!expectedToken) {
            request.log.error('[ServiceAuth] CIE_SERVICE_TOKEN não configurado — recusando toda chamada às rotas protegidas.');
            return reply.fail({
                type: 'internal-error',
                detail: 'Serviço não configurado corretamente.',
                instance: request.url,
            });
        }

        const token = extractToken(request);
        if (!token || token !== expectedToken) {
            return reply.fail({
                type: 'unauthorized',
                detail: 'Token de serviço ausente ou inválido.',
                instance: request.url,
            });
        }
    });
}
