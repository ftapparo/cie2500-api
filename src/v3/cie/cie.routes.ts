import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { CieManager } from '../../core/cie-manager';
import { trimNulls } from '../../core/utils';
import { successResponseSchema } from '../shared/response';
import type { CieActiveType } from '../../types/logs';
import {
    activeEventsDataSchema,
    activeTypeQuerySchema,
    alarmActiveSnapshotSchema,
    blockCountersSchema,
    cieStateSnapshotSchema,
    eventKindQuerySchema,
    logsListDataSchema,
    logTypeQuerySchema,
    outputCountersSchema,
    panelDataSchema,
} from './cie.schema';

const LOG_TYPES = ['alarme', 'falha', 'supervisao', 'operacao', 'bloqueio'] as const;

function parseLimit(value: unknown, fallback = 50): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(200, Math.floor(n));
}

/**
 * Rotas de leitura do CIE na v3 — somente consulta de estado, sem
 * acionar nenhum comando físico na central. Reaproveita os mesmos
 * serviços de core/ que a v2 usa (CieStateService, CieLogService,
 * CieCommandService), sem duplicar lógica de negócio.
 */
export async function cieRoutes(app: FastifyInstance, cieInstance: CieManager) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();
    const stateService = cieInstance.getStateService();
    const logService = cieInstance.getLogService();
    const commandService = cieInstance.getCommandService();

    typedApp.get('/cie/status', {
        schema: { response: { 200: successResponseSchema(cieStateSnapshotSchema) } },
    }, async (_request, reply) => {
        reply.ok(stateService.getSnapshot());
    });

    typedApp.get('/cie/panel', {
        schema: { response: { 200: successResponseSchema(panelDataSchema) } },
    }, async (_request, reply) => {
        const snapshot = stateService.getSnapshot();
        // Último incêndio/falha de verdade: ignora restaurações e "Saída Confirmada".
        const latestFailureEvent = logService.latestByKind('falha', 'ativacao');
        const latestAlarmEvent = logService.latestByKind('alarme', 'ativacao');
        const restartingUntil = Number(snapshot.restartingUntil || 0);
        const restarting = Number.isFinite(restartingUntil) && restartingUntil > Date.now();

        reply.ok({
            online: snapshot.connected,
            connected: snapshot.connected,
            restarting,
            restartingUntil: restarting ? restartingUntil : null,
            reconnecting: snapshot.reconnecting,
            reconnectAttempt: snapshot.reconnectAttempt,
            lastError: snapshot.lastError,
            lastUpdated: snapshot.lastUpdated,
            central: {
                ip: process.env.CIE_IP ?? null,
                endereco: Number(process.env.CIE_ENDERECO ?? 0),
                nome: typeof snapshot.nomeModelo?.nome === 'string' ? trimNulls(snapshot.nomeModelo.nome) : null,
                modelo: snapshot.nomeModelo?.modelo ?? null,
                mac: snapshot.mac?.mac ?? null,
            },
            dataHora: snapshot.dataHora,
            counters: snapshot.status?.status ?? null,
            leds: snapshot.status?.leds ?? null,
            latestFailureEvent,
            latestAlarmEvent,
            situation: stateService.getSituation(),
        });
    });

    typedApp.get('/cie/alarms/active', {
        schema: { response: { 200: successResponseSchema(alarmActiveSnapshotSchema) } },
    }, async (_request, reply) => {
        reply.ok({
            ...logService.activeAlarmSnapshot(stateService.getCounters()),
            situation: stateService.getSituation(),
        });
    });

    typedApp.get('/cie/events/active', {
        schema: {
            querystring: z.object({ type: activeTypeQuerySchema.optional() }),
            response: { 200: successResponseSchema(activeEventsDataSchema) },
        },
    }, async (request, reply) => {
        const { type } = request.query;
        const all = logService.activeAll();
        const events: Partial<Record<CieActiveType, typeof all.alarme>> = type ? { [type]: all[type] } : all;

        reply.ok({
            counters: stateService.getCounters(),
            situation: stateService.getSituation(),
            events,
        });
    });

    typedApp.get('/cie/logs', {
        schema: {
            querystring: z.object({
                type: logTypeQuerySchema.optional(),
                kind: eventKindQuerySchema.optional(),
                limit: z.coerce.number().optional(),
                cursor: z.string().optional(),
            }),
            response: { 200: successResponseSchema(logsListDataSchema) },
        },
    }, async (request, reply) => {
        const { type, kind, limit: rawLimit, cursor } = request.query;
        const limit = parseLimit(rawLimit, 50);

        if (!cursor && type && LOG_TYPES.includes(type)) {
            await stateService.ensureLogs(type, limit);
        } else if (!cursor && stateService.isWarmingUp()) {
            await stateService.waitForWarmup(12000);
        }

        const result = logService.list({ type, kind, limit, cursor });

        reply.ok({
            type: type ?? 'all',
            limit,
            cursor: cursor ?? null,
            nextCursor: result.nextCursor,
            items: result.items,
        });
    });

    typedApp.get('/cie/counters/blocks', {
        schema: { response: { 200: successResponseSchema(blockCountersSchema) } },
    }, async (_request, reply) => {
        try {
            const counters = await commandService.getBlockCounters();
            reply.ok(counters);
        } catch (error: unknown) {
            const err = error as { status?: number; message?: string };
            reply.fail({
                type: 'upstream-error',
                title: 'Falha ao consultar contadores de bloqueio.',
                status: err?.status ?? 500,
                detail: err?.message ?? null,
            });
        }
    });

    typedApp.get('/cie/counters/outputs', {
        schema: { response: { 200: successResponseSchema(outputCountersSchema) } },
    }, async (_request, reply) => {
        try {
            const counters = await commandService.getOutputCounters();
            reply.ok(counters);
        } catch (error: unknown) {
            const err = error as { status?: number; message?: string };
            reply.fail({
                type: 'upstream-error',
                title: 'Falha ao consultar contadores de saída.',
                status: err?.status ?? 500,
                detail: err?.message ?? null,
            });
        }
    });
}
