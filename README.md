<div align="center">

# 🔥 Nova CIE - Gateway da Central de Incêndio

**Microserviço REST + WebSocket para integração com a central de incêndio Intelbras CIE2500**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/ftapparo/cie2500-api)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-20.x-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Arquitetura](#-arquitetura)
- [Tecnologias](#-tecnologias)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Execução](#-execução)
- [API REST](#-api-rest)
- [WebSocket](#-websocket)
- [Documentação Swagger](#-documentação-swagger)
- [Relay de Push](#-relay-de-push)
- [Docker](#-docker)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Runbook de Validação em Campo](#-runbook-de-validação-em-campo)
- [Changelog](#-changelog)
- [Licença](#-licença)
- [Autor](#-autor)

---

## 🎯 Sobre o Projeto

**Nova CIE** é o microserviço de integração com a central de incêndio **Intelbras CIE2500** do **Condomínio Nova Residence**. Comunica-se com a central via socket, expõe status/comandos/logs por REST e WebSocket, e retransmite alarmes e falhas para a `nova-api` (que envia notificações Web Push aos moradores).

### ✨ Diferenciais

- **Comunicação direta com a central** via binding sobre o SDK do fabricante
- **WebSocket em tempo real** para status, alarmes e falhas
- **Relay de push assíncrono** para a API principal, com cooldown e retry
- **Watchdog opcional** de reinício e descoberta multicast, configuráveis por ambiente
- **Logs classificados** por tipo (alarme, falha, supervisão, operação, bloqueio)

---

## 🚀 Funcionalidades

### Monitoramento
- ✅ Status e painel em tempo real da central
- ✅ Contadores de blocos e saídas
- ✅ Logs classificados com paginação por cursor
- ✅ Alarmes ativos

### Controle Remoto
- ✅ Silenciar, liberar e reiniciar a central
- ✅ Sirenes de brigada, geral e com atraso
- ✅ Bloqueio/liberação de dispositivos e saídas específicas
- ✅ Reconexão manual via API

### Notificações
- ✅ Relay de alarme e falha para a `nova-api` (Web Push)
- ✅ Cooldown configurável para evitar flood de notificações
- ✅ Push de falha só é enviado quando o bip não está silenciado

---

## 🏗️ Arquitetura

O código separa a lógica de negócio (agnóstica de framework HTTP) da camada de API:

```
┌─────────────────────────────────────────────┐
│          v2/ — API REST (Express)            │
│  Rotas expostas em /v1/api (ver abaixo)      │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│          core/ — Core Business Logic         │
│  CieClient, CieManager, Services,           │
│  WebSocket Broker                            │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│          Integrações Externas                │
│  Central CIE2500 (socket), nova-api (relay)  │
└─────────────────────────────────────────────┘
```

`CieManager` é agnóstico de framework HTTP: recebe um `http.Server` externo via `bindWebSocket()`, e é criado uma única vez no `server.ts`. Isso permite que uma futura camada de API rode lado a lado com a atual no mesmo processo, compartilhando a mesma conexão TCP com a central — que só pode existir uma vez por processo.

### Camadas do Sistema

**API Layer** (`src/v2/api/`, `src/v2/routes/`, `src/v2/controllers/`, `src/v2/middleware/`)
- Exposição de endpoints REST (base `/v1/api`, apesar do nome da pasta `v2/`)
- Documentação Swagger

**Core Layer** (`src/core/`)
- `cie-client.ts` — protocolo de baixo nível com a central (socket)
- `cie-manager.ts` — orquestra client, serviços e WebSocket broker
- `services/` — estado, comando, log, relay de push
- `ws/` — WebSocket broker (recebe um `http.Server` externo)
- `native/` — binding sobre o SDK vendorizado da Intelbras
- `utils.ts`, `config.ts`

**Vendor** (`src/intelbras/`)
- SDK original do fabricante Intelbras — não modificar

---

## 🛠️ Tecnologias

### Runtime e Linguagem
- **Node.js 20.x** - Ambiente de execução
- **TypeScript** - Linguagem com tipagem estática

### Framework e API
- **Express** - Framework web da camada v2
- **ws** - WebSocket server
- **Swagger UI** - Documentação interativa da API

### Comunicação e Integrações
- **net/dgram** (Node.js) - Socket TCP/UDP com a central
- **axios** - Cliente HTTP para relay de push à `nova-api`

### Ambiente e Configuração
- **dotenv** - Gerenciamento de variáveis de ambiente

### Desenvolvimento
- **ts-node-dev** - Hot reload para desenvolvimento

---

## 📦 Instalação

### Pré-requisitos

- Node.js >= 20.x
- npm >= 10.x
- Docker (opcional, recomendado para produção)
- Rede com acesso à central CIE2500 (portas TCP/UDP configuradas)

### Clonar o Repositório

```bash
git clone https://github.com/ftapparo/cie2500-api.git
cd cie2500-api
```

### Instalar Dependências

```bash
npm install
```

### Compilar TypeScript

```bash
npm run build
```

---

## ⚙️ Configuração

Copie `.env.example` para `.env` e ajuste:

- `PORT` (padrão: `4021`)
- `CIE_IP`, `CIE_PASSWORD`, `CIE_ENDERECO`
- `CIE_POLL_MS`
- `CIE_REQUEST_TIMEOUT_MS`
- `CIE_LOG_BACKFILL_LIMIT`
- `CIE_LOG_RING_SIZE`
- `CIE_DISCOVERY_ENABLED` (default recomendado em Docker Windows: `false`)
- `CIE_RESTART_WATCHDOG_ENABLED` (default recomendado em Docker: `false`)
- `CIE_CMD_*` (mapeamento dos comandos críticos)
- `MAIN_API_BASE_URL` (base da nova-api para relay de push)
- `MAIN_API_PUSH_TIMEOUT_MS` (default: `3000`)
- `MAIN_API_PUSH_RETRIES` (default: `3`)
- `CIE_PUSH_FIRE_ALARM_COOLDOWN_MS` (default: `60000`)
- `CIE_PUSH_FAILURE_ALARM_COOLDOWN_MS` (default: `60000`)

---

## 🚀 Execução

### Modo Desenvolvimento

```bash
npm run dev
```

### Modo Produção

```bash
npm run build
npm start
```

---

## 🌐 API REST

Base: `/v1/api`

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health`, `/healthcheck` | Healthcheck e conexão com a central |
| GET | `/cie/status` | Status atual |
| GET | `/cie/panel` | Painel consolidado |
| GET | `/cie/alarms/active` | Alarmes ativos |
| GET | `/cie/logs?type=&limit=&cursor=` | Logs classificados (`alarme`, `falha`, `supervisao`, `operacao`, `bloqueio`) |
| GET | `/cie/counters/blocks` | Contadores de blocos |
| GET | `/cie/counters/outputs` | Contadores de saídas |
| POST | `/cie/commands/silence` | Silenciar |
| POST | `/cie/commands/release` | Liberar |
| POST | `/cie/commands/restart` | Reiniciar central |
| POST | `/cie/commands/brigade-siren` | Sirene de brigada |
| POST | `/cie/commands/alarm-general` | Alarme geral |
| POST | `/cie/commands/delay-siren` | Sirene com atraso |
| POST | `/cie/commands/silence-bip` | Silenciar bip |
| POST | `/cie/commands/silence-siren` | Silenciar sirene |
| POST | `/cie/commands/block` | Bloquear dispositivo |
| POST | `/cie/commands/output` | Controlar saída |
| POST | `/cie/connection/reconnect` | Forçar reconexão |

---

## 🔌 WebSocket

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

---

## 📚 Documentação Swagger

- Interface: `/swagger`
- Spec JSON: `/apispec_1.json`

---

## 📡 Relay de Push

Quando `cie.alarm.triggered` ocorre, o serviço tenta enviar para:

```
POST {MAIN_API_BASE_URL}/v2/api/push/events/fire-alarm
```

Comportamento:

- Envio assíncrono e não bloqueante do loop principal da CIE
- Cooldown de envio para evitar flood de notificações
- Push de falha só é enviado quando o bip não estiver silenciado
- Retry com backoff curto
- Logs estruturados com `requestId`, tentativa e tempo de resposta

---

## 🐳 Docker

```bash
docker compose up --build -d
```

Observações para Docker no Windows:

- Publique as portas UDP `12345/12346/12347` (já previstas no compose)
- Use `CIE_DISCOVERY_ENABLED=false` para operar sem descoberta multicast
- Mantenha `CIE_IP` fixo da central
- Se o ambiente for instável, use `CIE_RESTART_WATCHDOG_ENABLED=false` para evitar reinício forçado do processo

O `docker-compose.yml` não define segredos: a stack roda via Portainer apontando para este repositório (Git-based), e as variáveis de ambiente reais são configuradas diretamente no Portainer — nunca commitadas.

---

## 📁 Estrutura do Projeto

```
cie2500-api/
├── src/
│   ├── server.ts               # Entry point da aplicação
│   ├── core/                   # Lógica de negócio, sem framework HTTP
│   │   ├── cie-client.ts       # Protocolo de baixo nível com a central
│   │   ├── cie-manager.ts      # Orquestra client, serviços e WS broker
│   │   ├── services/           # Estado, comando, log, relay de push
│   │   ├── ws/                 # WebSocket broker
│   │   ├── native/             # Binding sobre o SDK da Intelbras
│   │   ├── utils.ts
│   │   └── config.ts
│   ├── v2/                     # API REST (Express), exposta em /v1/api
│   │   ├── swagger.json
│   │   ├── api/
│   │   │   └── web-server.api.ts
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── middleware/
│   ├── intelbras/               # SDK vendorizado do fabricante (não modificar)
│   └── types/
├── .env.example
├── .gitignore
├── CHANGELOG.md
├── README.md
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

## 🧪 Runbook de Validação em Campo

1. **Confirmar conexão**: chamar `GET /v1/api/health` e validar `connected=true`.

2. **Validar evento de disparo**: simular disparo na central, confirmar incremento em `/v1/api/cie/alarms/active` e recebimento de `cie.alarm.triggered` no `/v1/ws`.

3. **Validar comando de silenciar**: ajustar `CIE_CMD_SILENCE_*`, chamar `POST /v1/api/cie/commands/silence`, validar LED/estado de sirene silenciada na central e no status.

4. **Validar comando de liberar**: ajustar `CIE_CMD_RELEASE_*`, chamar `POST /v1/api/cie/commands/release`, validar retomada das sirenes.

5. **Validar comando de reiniciar central**: ajustar `CIE_CMD_RESTART_*`, chamar `POST /v1/api/cie/commands/restart`, validar transição de conexão e retorno da comunicação.

---

## 📄 Changelog

Para ver o histórico completo de versões e alterações, consulte o [CHANGELOG.md](CHANGELOG.md).

---

## 📝 Licença

Este projeto está licenciado sob a **MIT License** - veja o arquivo [LICENSE](LICENSE) para mais detalhes, se presente.

---

## 👤 Autor

**Flavio Eduardo Tapparo**

- GitHub: [@ftapparo](https://github.com/ftapparo)
- Projeto: [cie2500-api](https://github.com/ftapparo/cie2500-api)

---

## 🏢 Contexto

Sistema desenvolvido para o **Condomínio Nova Residence** para integração da central de incêndio Intelbras CIE2500 com o restante do ecossistema de automação predial.

---

<div align="center">

**Desenvolvido com ❤️ para automação inteligente**

[⬆ Voltar ao topo](#-nova-cie---gateway-da-central-de-incêndio)

</div>
