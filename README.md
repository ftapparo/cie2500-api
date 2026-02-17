# CIE2500 Service

Microservico REST + WebSocket para integracao com central de incendio Intelbras CIE2500.

## Endpoints REST

Base: `/v1/api`

- `GET /health`
- `GET /healthcheck`
- `GET /cie/status`
- `GET /cie/panel`
- `GET /cie/alarms/active`
- `GET /cie/logs?type=alarme|falha|supervisao|operacao|bloqueio&limit=50&cursor=0`
- `GET /cie/counters/blocks`
- `GET /cie/counters/outputs`
- `POST /cie/commands/silence`
- `POST /cie/commands/release`
- `POST /cie/commands/restart`
- `POST /cie/commands/brigade-siren`
- `POST /cie/commands/alarm-general`
- `POST /cie/commands/delay-siren`
- `POST /cie/commands/silence-bip`
- `POST /cie/commands/silence-siren`
- `POST /cie/commands/block`
- `POST /cie/commands/output`
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
- `cie.failure.triggered`
- `cie.log.received`

Envelope:

```json
{
  "event": "cie.status.updated",
  "timestamp": "2026-02-12T20:00:00.000Z",
  "data": {}
}
```

## Variaveis de ambiente

Copie `.env.example` para `.env` e ajuste:

- `CIE_IP`, `CIE_PASSWORD`, `CIE_ENDERECO`
- `CIE_POLL_MS`
- `CIE_REQUEST_TIMEOUT_MS`
- `CIE_LOG_BACKFILL_LIMIT`
- `CIE_LOG_RING_SIZE`
- `CIE_DISCOVERY_ENABLED` (default recomendado em Docker Windows: `false`)
- `CIE_RESTART_WATCHDOG_ENABLED` (default recomendado em Docker: `false`)
- `CIE_CMD_*` (mapeamento dos comandos criticos)
- `MAIN_API_BASE_URL` (base da API principal para relay de push)
- `MAIN_API_PUSH_TIMEOUT_MS` (default: `3000`)
- `MAIN_API_PUSH_RETRIES` (default: `3`)
- `CIE_PUSH_FIRE_ALARM_COOLDOWN_MS` (default: `60000`)
- `CIE_PUSH_FAILURE_ALARM_COOLDOWN_MS` (default: `60000`)

## Relay de push (Sprint 2)

Quando o evento `cie.alarm.triggered` ocorre, o servico tenta enviar para:

- `POST {MAIN_API_BASE_URL}/v2/api/push/events/fire-alarm`

Comportamento:

- envio assincrono e nao bloqueante do loop principal da CIE;
- cooldown de envio aplicado no CIE para evitar flood de notificacoes;
- push de falha so e enviado quando o bip nao estiver silenciado;
- retry com backoff curto;
- logs estruturados com `requestId`, tentativa e tempo de resposta.

## Execucao local

```bash
npm install
npm run dev
```

## Docker

```bash
docker compose up --build -d
```

Observacoes para Docker no Windows:

- publique as portas UDP `12345/12346/12347` (ja previstas no compose);
- use `CIE_DISCOVERY_ENABLED=false` para operar sem descoberta multicast;
- mantenha `CIE_IP` fixo da central;
- se o ambiente for instavel, use `CIE_RESTART_WATCHDOG_ENABLED=false` para evitar reinicio forcado do processo.

## Runbook de validacao em campo

1. Confirmar conexao:
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
- validar transicao de conexao e retorno da comunicacao.
