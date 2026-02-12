# CIE2500 Service

Microserviço REST + WebSocket para integração com central de incêndio Intelbras CIE2500.

## Endpoints REST

Base: `/v1/api`

- `GET /health`
- `GET /healthcheck`
- `GET /cie/status`
- `GET /cie/alarms/active`
- `GET /cie/logs?type=alarme|falha|supervisao|operacao&limit=50&cursor=0`
- `POST /cie/commands/silence`
- `POST /cie/commands/release`
- `POST /cie/commands/restart`
- `POST /cie/connection/reconnect`

Swagger:

- `GET /swagger`
- `GET /apispec_1.json`

## WebSocket

Endpoint: `/v1/ws`

Eventos:

- `connection.status.changed`
- `cie.status.updated`
- `cie.alarm.triggered`
- `cie.log.received`

Envelope:

```json
{
  "event": "cie.status.updated",
  "timestamp": "2026-02-12T20:00:00.000Z",
  "data": {}
}
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste:

- `CIE_IP`, `CIE_PASSWORD`, `CIE_ENDERECO`
- `CIE_POLL_MS`
- `CIE_REQUEST_TIMEOUT_MS`
- `CIE_LOG_BACKFILL_LIMIT`
- `CIE_LOG_RING_SIZE`
- `CIE_CMD_*` (mapeamento dos comandos críticos)

## Execução local

```bash
npm install
npm run dev
```

## Docker

```bash
docker compose up --build -d
```

## Runbook de validação em campo

1. Confirmar conexão:
- chamar `GET /v1/api/health` e validar `connected=true`.

2. Validar evento de disparo:
- simular disparo na central;
- confirmar incremento em `/v1/api/cie/alarms/active`;
- confirmar recebimento de `cie.alarm.triggered` no `/v1/ws`.

3. Validar comando de silenciar:
- ajustar `CIE_CMD_SILENCE_*`;
- chamar `POST /v1/api/cie/commands/silence`;
- validar LED/estado de sirene silenciada na central e no status.

4. Validar comando de liberar:
- ajustar `CIE_CMD_RELEASE_*`;
- chamar `POST /v1/api/cie/commands/release`;
- validar retomada das sirenes.

5. Validar comando de reiniciar central:
- ajustar `CIE_CMD_RESTART_*`;
- chamar `POST /v1/api/cie/commands/restart`;
- validar transição de conexão e retorno da comunicação.
