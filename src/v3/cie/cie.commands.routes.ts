import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { CieManager } from '../../core/cie-manager';
import { successResponseSchema } from '../shared/response';
import {
    blockCommandBodySchema,
    commandResultSchema,
    CONFIRM_REQUIRED_ACTIONS,
    outputCommandBodySchema,
    reconnectResultSchema,
    simpleCommandActionSchema,
    simpleCommandBodySchema,
} from './cie.schema';

// Respostas da central aceitas como sucesso para um comando de botão.
// Qualquer outro status significa que a central recusou o comando.
const ACCEPTED_BUTTON_STATUS = ['StatusBotaoOk', 'StatusBotaoWaiting'];

// Quem acionou: a nova-api repassa o ator do token em x-actor-id/role.
// Registro operacional — a auditoria imutável é item à parte (CHECKLIST 3.2).
const logCommand = (request: FastifyRequest, action: string) => {
    const actorId = request.headers['x-actor-id'] ?? 'desconhecido';
    const actorRole = request.headers['x-actor-role'] || 'sem papel';
    console.log(`[ApiV3] Comando ${action} solicitado por ${actorId} (${actorRole})`);
};

const failCommand = (request: FastifyRequest, reply: FastifyReply, error: unknown, title: string) => {
    const err = error as { status?: number; message?: string };
    if (err?.status === 409) {
        return reply.fail({ type: 'conflict', title, detail: err.message ?? null, instance: request.url });
    }
    return reply.fail({ type: 'upstream-error', title, detail: err?.message ?? null, instance: request.url });
};

/**
 * Comandos da central de incêndio na v3 — acionam o equipamento físico.
 * Mesma regra de negócio da v2 (src/v2/controllers/cie.controller.ts),
 * sobre os mesmos serviços de core/. Autorização por usuário/papel é
 * decidida na nova-api; aqui só entra quem tem o token de serviço.
 */
export async function cieCommandRoutes(app: FastifyInstance, cieInstance: CieManager) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();
    const stateService = cieInstance.getStateService();
    const commandService = cieInstance.getCommandService();

    // Rotas estáticas (block/output) são registradas antes da paramétrica;
    // o roteador do Fastify já prioriza estáticas, mas a ordem deixa
    // explícito que :action nunca captura esses dois nomes.
    typedApp.post('/cie/commands/block', {
        schema: {
            body: blockCommandBodySchema,
            response: { 200: successResponseSchema(commandResultSchema) },
        },
    }, async (request, reply) => {
        logCommand(request, 'block');
        try {
            const payload = request.body;
            const response = await commandService.executeBlockCommand(payload);
            await stateService.refreshNow();
            reply.ok({ action: 'block', payload, response, snapshot: stateService.getSnapshot() });
        } catch (error) {
            failCommand(request, reply, error, 'Falha ao executar comando de bloqueio.');
        }
    });

    typedApp.post('/cie/commands/output', {
        schema: {
            body: outputCommandBodySchema,
            response: { 200: successResponseSchema(commandResultSchema) },
        },
    }, async (request, reply) => {
        logCommand(request, 'output');
        try {
            const payload = request.body;
            const response = await commandService.executeOutputCommand(payload);
            await stateService.refreshNow();
            reply.ok({ action: 'output', payload, response, snapshot: stateService.getSnapshot() });
        } catch (error) {
            failCommand(request, reply, error, 'Falha ao executar comando de saída.');
        }
    });

    typedApp.post('/cie/commands/:action', {
        schema: {
            params: z.object({ action: simpleCommandActionSchema }),
            body: simpleCommandBodySchema,
            response: { 200: successResponseSchema(commandResultSchema) },
        },
    }, async (request, reply) => {
        const { action } = request.params;

        if (CONFIRM_REQUIRED_ACTIONS.includes(action) && request.body?.confirm !== true) {
            return reply.fail({
                type: 'validation-error',
                detail: 'Este comando exige confirmação explícita.',
                instance: request.url,
                validationErrors: [{ path: '/confirm', message: 'Envie confirm: true.' }],
            });
        }

        logCommand(request, action);
        try {
            const response = await commandService.execute(action);
            const buttonStatus = String((response as { resposta?: unknown })?.resposta ?? '');
            if (buttonStatus && !ACCEPTED_BUTTON_STATUS.includes(buttonStatus)) {
                return reply.fail({
                    type: 'conflict',
                    title: 'Comando rejeitado pela central.',
                    detail: buttonStatus,
                    instance: request.url,
                });
            }

            if (action === 'restart') {
                stateService.markRestarting(60000);
            } else {
                await stateService.refreshNow();
            }

            reply.ok({ action, response, snapshot: stateService.getSnapshot() });
        } catch (error) {
            failCommand(request, reply, error, 'Falha ao executar comando.');
        }
    });

    typedApp.post('/cie/connection/reconnect', {
        schema: { response: { 200: successResponseSchema(reconnectResultSchema) } },
    }, async (request, reply) => {
        logCommand(request, 'reconnect');
        try {
            await stateService.reconnectNow();
            reply.ok({ snapshot: stateService.getSnapshot() });
        } catch (error) {
            failCommand(request, reply, error, 'Falha ao reconectar com a central.');
        }
    });
}
