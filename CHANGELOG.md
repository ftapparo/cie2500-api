# Changelog - CIE2500 Service

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Unreleased]

### Adicionado
- Cadastro da central (`src/core/data/cie-installation.json`, gerado por `scripts/import-cie-config.js` a partir do `.cie` do ProgramadorCIE, sem senhas nem rede): 8 zonas, 8 regras e 288 dispositivos. Completa cada evento: subtipo real (a S2 é "Sirene Convencional", truncada no UDP), regra das operações (`display.rule`, ex.: 49 com endereço 7 = regra 7 "TORRE C"), local de todo endereço cadastrado, inclusive de registros antigos com nome genérico. Nova `GET /v3/api/cie/installation`. `*.cie` no `.gitignore`.
- `display.place` reconhece as variações reais de nome ("1ANDAR A T-A", "9 ANDAR AT-B", "TERREO A T-A", "PRESSURIZ. T-A", "MOD LIGA T A", "GARAGEM -2 F", "ELEVADOR 1") e ganha `areaDetail`; laço 0 vira "Central de incêndio". Garagem com nível ("GARAGEM -2 F") vira `floor: -2` ("Subsolo 2"), com a letra crua em `areaDetail`.
- Interpretação completa dos eventos da central (`src/core/services/cie-event-catalog.ts`), com a tabela de códigos do ProgramadorCIE: alarme 0–6, supervisão 0–3, falha 0–52 e operação 0–60. Todo log ganha `event` (`category`, `code`, `label`, `kind`, `severity`), `display` (cada dado em um campo: `title`, `device`, `deviceName`, `place`, `loop`, `address`, `zone`, `zoneName`; `place` interpreta o nome cadastrado — "16 ANDAR B T-B" = torre B, 16º andar, posição B no andar), `source`, `number`, `firstEvent`, `origin`, `repeater` e `historyTotal`. Os campos antigos continuam iguais; a v2 só recebe os campos extras.
- Leitura dos eventos ativos da central (`getEvent`), relida sempre que um contador do status muda: `GET /v3/api/cie/events/active?type=`, `activeAlarms` em `/v3/api/cie/alarms/active` e evento `cie.active.updated`, publicado só no `/v3/ws`.
- `situation` (situação geral pronta para exibir) em `/v3/api/cie/panel` e `/v3/api/cie/alarms/active`; filtro `kind=` em `/v3/api/cie/logs`.
- Sincronização periódica do histórico (`CIE_LOG_SYNC_MS`, padrão 15 s), inclusive de operações, que antes só eram lidas na conexão inicial. Limite de ativos lidos por tipo em `CIE_ACTIVE_EVENTS_LIMIT` (padrão 50).
- Push pela v3 envia `x-service-name: cie`, para o histórico de comandos da `nova-api` mostrar `servico:cie`.
- Push de alarme/falha pode ir para a v3 da `nova-api`: com `MAIN_API_V3_BASE_URL` definida (ex.: `http://nova-api:3031`), o relay envia para `/v3/api/push/send` autenticado por `API_SERVICE_TOKEN`. Sem a variável, segue em `/v2/api/push/send` como sempre (padrão). `MAIN_API_BASE_URL` continua sendo a chave que liga o relay.
- Comandos da central na v3 (`src/v3/cie/cie.commands.routes.ts`): `POST /v3/api/cie/commands/:action` (as 10 ações de botão da v2), `/commands/block`, `/commands/output` e `/connection/reconnect`. Mesma regra de negócio da v2 sobre os mesmos serviços de `core/`; corpo validado por Zod; `alarm-general` e `restart` exigem `{ "confirm": true }`; central recusando o comando responde `409`. Registra no log o ator repassado pela `nova-api` (`x-actor-id`/`x-actor-role`). A v2 não foi alterada.
- WebSocket `/v3/ws` no servidor da v3, com os mesmos eventos do `/v1/ws`: exige `CIE_SERVICE_TOKEN` no upgrade (401 antes do handshake), limite de conexões (`CIE_WS_V3_MAX_CLIENTS`, padrão 5, excedente recebe 503), heartbeat de 30 s e `meta.version: "v3"` nas mensagens. Consumidor previsto: só a `nova-api` pela rede interna. O `/v1/ws` segue como estava.

- Rotas de leitura do CIE migradas para a v3 (`GET /v3/api/cie/status`, `/panel`, `/alarms/active`, `/logs`, `/counters/blocks`, `/counters/outputs`), reaproveitando os mesmos serviços de `core/` que a v2 usa (`CieStateService`, `CieLogService`, `CieCommandService`), sem duplicar lógica de negócio. Schemas Zod completos em `src/v3/cie/cie.schema.ts`.
- Autenticação de serviço na v3 (`src/v3/shared/service-auth.ts`): todas as rotas protegidas (exceto `/v3/api/health` e `/healthcheck`) exigem `Authorization: Bearer <CIE_SERVICE_TOKEN>`. Só a `nova-api` (rede interna) deve conhecer esse segredo — autorização por usuário/papel continua sendo decidida na `nova-api` antes de repassar a chamada, o CIE só verifica a origem da requisição.
- Documentação Swagger das 6 rotas de leitura adicionada em `src/v3/openapi.json` (`securityScheme` `ApiToken`, tag `CIE`).

### Corrigido
- Bloqueios fora da leitura de eventos ativos: em campo, `getEvent` para bloqueio devolve o último registro de operação repetido em todos os números (o ProgramadorCIE também não pede essa lista). `events.bloqueio` fica vazio; o número de bloqueios segue em `counters.bloqueio` e o detalhe em `/cie/counters/blocks`.
- Novas falhas e alarmes podiam não ser lidos: o backfill usava o contador de eventos **ativos** como índice do **histórico** (em que 1 é o mais recente) e relia registros antigos. Agora o histórico é lido a partir do registro 1 até encontrar um já conhecido.
- A categoria 3 do canal de eventos ativos (bloqueio) era sobrescrita como operação; cada canal agora tem o seu mapeamento.
- Rótulos de dispositivo corrigidos conforme o ProgramadorCIE: tipo 12 "Saída Local" (antes saía "Acionador Manual"), tipo 10 "Sinalizador Audiovisual" e subtipos 5–13; o tipo tem prioridade sobre o subtipo, que chega com só 3 bits pelo UDP.
- Push de alarme/falha usa o evento ativo que é uma ativação real e o rótulo dele, em vez do último log com texto fixo ("Disp. em Alarme"), que podia ser uma restauração ou a sirene confirmada. Falha não notifica quando todas as falhas ativas são restauração/registro. Gatilhos, cooldowns e contrato com a `nova-api` não mudaram.
- Swagger UI (`/v3/swagger`) e o spec (`/v3/apispec_1.json`) exigiam indevidamente o token de acesso — o hook de autenticação de serviço isentava só `/v3/api/health`, não a documentação. Ambos já são protegidos pela flag `SWAGGER_V3_ENABLED`; agora ficam explicitamente fora da verificação de token.
- Descrição do `securityScheme` e mensagens de erro 401 no spec público detalhavam o mecanismo interno de autenticação (nome do token, projetos envolvidos) — reduzidas a texto genérico, já que o spec é documentação pública exposta via Swagger UI.

### Alterado
- `CieManager.bindWebSocket(server, path?, options?)` aceita vários brokers (um por camada HTTP). Os listeners de estado — incluindo o relay de push de alarme/falha — são registrados uma única vez, para não duplicar push na API. `CieWsBroker` ganhou opções (`authorize`, `maxClients`, `heartbeatMs`, `version`); sem opções, o comportamento é o mesmo de antes.
- Checagem do token de serviço extraída para `hasValidServiceToken()` (`src/v3/shared/service-auth.ts`), agora em tempo constante, reutilizada pelo hook HTTP e pelo upgrade do WebSocket.

- Reorganização estrutural do código: `controllers/`, `routes/`, `middleware/` e `api/` movidos para `src/v2/` (camada Express atual, sem mudança de comportamento). `services/`, `ws/`, `native/`, `config.ts` e `utils.ts` movidos para dentro de `src/core/`, junto do driver real da central (`cie-client`, `cie-manager`), que já vivia em `core/`. `CieManager` já era agnóstico de framework HTTP (recebe um `http.Server` via `bindWebSocket`) — preparação para uma futura v2 de API (este projeto usa `/v1/api` hoje) que compartilhará a mesma conexão TCP com a central, o WebSocket broker e os serviços de estado/comando/log. `src/intelbras/` (SDK vendorizado do fabricante) não foi tocado.
- `src/v3/` reorganizado por feature, seguindo `AI-Friendly Architecture Specification.md` (raiz do workspace): `routes/` e `lib/` viraram `health/`, `cie/` (uma pasta por feature) e `shared/` (só o que é genuinamente transversal — `response.ts`, `reply-helpers.ts`, `service-auth.ts`). Sem mudança de comportamento.

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
