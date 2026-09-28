# Changelog - CIE2500 Service

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Unreleased]

### Adicionado
- Rotas de leitura do CIE migradas para a v3 (`GET /v3/api/cie/status`, `/panel`, `/alarms/active`, `/logs`, `/counters/blocks`, `/counters/outputs`), reaproveitando os mesmos serviços de `core/` que a v2 usa (`CieStateService`, `CieLogService`, `CieCommandService`), sem duplicar lógica de negócio. Schemas Zod completos em `src/v3/lib/cie-schemas.ts`.
- Autenticação de serviço na v3 (`src/v3/lib/service-auth.ts`): todas as rotas protegidas (exceto `/v3/api/health` e `/healthcheck`) exigem `Authorization: Bearer <CIE_SERVICE_TOKEN>`. Só a `nova-api` (rede interna) deve conhecer esse segredo — autorização por usuário/papel continua sendo decidida na `nova-api` antes de repassar a chamada, o CIE só verifica a origem da requisição.
- Documentação Swagger das 6 rotas de leitura adicionada em `src/v3/openapi.json` (`securityScheme` `ServiceToken`, tag `CIE`).

### Alterado
- Reorganização estrutural do código: `controllers/`, `routes/`, `middleware/` e `api/` movidos para `src/v2/` (camada Express atual, sem mudança de comportamento). `services/`, `ws/`, `native/`, `config.ts` e `utils.ts` movidos para dentro de `src/core/`, junto do driver real da central (`cie-client`, `cie-manager`), que já vivia em `core/`. `CieManager` já era agnóstico de framework HTTP (recebe um `http.Server` via `bindWebSocket`) — preparação para uma futura v2 de API (este projeto usa `/v1/api` hoje) que compartilhará a mesma conexão TCP com a central, o WebSocket broker e os serviços de estado/comando/log. `src/intelbras/` (SDK vendorizado do fabricante) não foi tocado.

## [2.0.0] - 2026

### Adicionado
- Microserviço REST + WebSocket para integração com a central de incêndio Intelbras CIE2500, via `src/core/native/CIE2500Native.ts` (binding sobre o SDK vendorizado do fabricante em `src/intelbras/`).
- Endpoints REST (`/v1/api`) para status, painel, contadores de blocos/saídas, logs classificados (alarme, falha, supervisão, operação, bloqueio) e comandos (silenciar, liberar, reiniciar, sirenes de brigada/geral/atraso, bloqueio/saída específicos).
- WebSocket (`/v1/ws`) com eventos em tempo real: `connection.status.changed`, `cie.status.updated`, `cie.alarm.triggered`, `cie.failure.triggered`, `cie.log.received`.
- Relay de push para a nova-api: eventos de alarme e falha disparam notificação via `POST {MAIN_API_BASE_URL}/v2/api/push/events/fire-alarm`, com cooldown, retry com backoff curto e envio assíncrono não bloqueante do loop principal.
- Suporte a variáveis de ambiente para descoberta multicast (`CIE_DISCOVERY_ENABLED`) e watchdog de reinício (`CIE_RESTART_WATCHDOG_ENABLED`), com defaults recomendados para operação em Docker no Windows.
- Interpretação de horário da central como UTC-3, independente do fuso do processo.

### Corrigido
- URL do healthcheck apontando para o endpoint incorreto.
- `env_file`/`COPY .env` removidos do Dockerfile e do `docker-compose.yml`: incompatíveis com stack Git-based do Portainer (o `.env` real não é versionado); variáveis passaram a ser repassadas explicitamente para dentro do container.

## [1.x] - anterior a 2026

Histórico anterior não documentado neste formato.
