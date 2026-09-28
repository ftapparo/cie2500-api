import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { CieManager } from '../../core/cie-manager';
import { trimNulls } from '../../core/utils';
import { successResponseSchema } from '../shared/response';
import {
    alarmActiveSnapshotSchema,
    blockCountersSchema,
    cieStateSnapshotSchema,
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
        const latestFailureEvent = logService.latestByType('falha', 1)[0] ?? null;
        const latestAlarmEvent = logService.latestByType('alarme', 1)[0] ?? null;
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
        });
    });

    typedApp.get('/cie/alarms/active', {
        schema: { response: { 200: successResponseSchema(alarmActiveSnapshotSchema) } },
    }, async (_request, reply) => {
        const snap = stateService.getSnapshot();
        const counters = {
            alarme: Number(snap.status?.status?.alarme || 0),
            falha: Number(snap.status?.status?.falha || 0),
            supervisao: Number(snap.status?.status?.supervisao || 0),
            bloqueio: Number(snap.status?.status?.bloqueio || 0),
        };
        reply.ok(logService.alarmSnapshot(counters));
    });

    typedApp.get('/cie/logs', {
        schema: {
            querystring: z.object({
                type: logTypeQuerySchema.optional(),
                limit: z.coerce.number().optional(),
                cursor: z.string().optional(),
            }),
            response: { 200: successResponseSchema(logsListDataSchema) },
        },
    }, async (request, reply) => {
        const { type, limit: rawLimit, cursor } = request.query;
        const limit = parseLimit(rawLimit, 50);

        if (!cursor && type && LOG_TYPES.includes(type)) {
            await stateService.ensureLogs(type, limit);
        } else if (!cursor && stateService.isWarmingUp()) {
            await stateService.waitForWarmup(12000);
        }

        const result = logService.list({ type, limit, cursor });

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
