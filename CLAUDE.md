# cie2500-api (nova-cie)

Microserviço de integração com a central de incêndio Intelbras CIE2500 do Condomínio Nova Residence. Comunicação direta via socket com a central, REST + WebSocket, relay de alarme/falha para a `nova-api` (que envia Web Push aos moradores).

Veja `README.md` para visão completa (endpoints, WebSocket, runbook de campo) e `CHANGELOG.md` para o histórico. Este arquivo é o contexto operacional para trabalhar no código.

## Commits

Este projeto usa um fluxo de commit específico — ver skill `commit` (`.claude/skills/commit/SKILL.md`). Resumo: separar commits por grupo lógico de mudança, mensagem com subject curto + corpo completo, atualizar `CHANGELOG.md` (seção `[Unreleased]`) antes do commit, apresentar para aprovação antes de commitar, perguntar antes de dar push. Nunca criar versão numerada nem tocar no `package.json` sem pedido explícito de "versionar".

## Arquitetura

```
src/
  core/              # lógica de negócio, sem framework HTTP
    cie-client.ts    # protocolo de baixo nível com a central (socket) — instância ÚNICA
    cie-manager.ts   # orquestra client, services e WebSocket broker
    services/        # cie-state, cie-command, cie-log, push-relay
    ws/              # WebSocket broker — recebe um http.Server externo via bindWebSocket()
    native/          # binding sobre o SDK vendorizado da Intelbras (CIE2500Native.ts)
    utils.ts, config.ts

  v2/                # API REST (Express) — apesar do nome, expõe /v1/api (não v2/api)
    api/, controllers/, routes/, middleware/

  intelbras/         # SDK original do fabricante — NÃO MODIFICAR, é vendor code
```

**Regra crítica**: existe uma única conexão física com a central por processo. `CieManager` é criado uma vez em `server.ts`, é agnóstico de framework HTTP (`bindWebSocket(server)` recebe qualquer `http.Server`) — se uma futura camada de API for adicionada, ela deve reutilizar a mesma instância, nunca criar uma segunda conexão com a central.

## Versionamento de rota é diferente dos outros dois projetos

Este projeto expõe `/v1/api` e `/v1/ws`, **não** `/v2/api` como `nova-api` e `nova-tag`. A pasta interna se chama `v2/` por convenção com os outros repositórios (mesma reorganização core/v2 aplicada aos três), mas isso não implica mudança no path público. Não confundir ao adicionar rotas ou ao integrar com o front/mobile.

## `src/intelbras/` é vendor code

SDK original do fabricante Intelbras (`ProgramadorCIE`, utilitários de protocolo TCP/UDP). Não editar esses arquivos — se precisar mudar comportamento, fazer isso em `core/native/CIE2500Native.ts`, que é o binding próprio sobre o SDK. O `tsconfig.json` exclui explicitamente partes dessa pasta do build (`ProgramadorCIE/**`, `CIE_USB.js`, `connectionController.js`).

## Comandos da central são configuráveis por env var

Cada ação (silenciar, liberar, reiniciar, sirenes) é mapeada para um par `botão + parâmetro` específico do protocolo Intelbras, configurável via `CIE_CMD_*_BUTTON`/`CIE_CMD_*_PARAM`. Ver `.env.example` para o mapeamento oficial documentado (referência: software `ProgramadorCIE`). Nunca hardcodar esses números no código — sempre vêm de env var, porque podem variar por instalação/central.

## Stack

Node.js 20 + TypeScript, Express, `ws` (WebSocket), `net`/`dgram` (socket com a central), axios (relay de push).

## Comandos

```bash
npm run build
npm run dev
npm start
npx tsc --noEmit
```

Sem suíte de testes automatizados — validação é o runbook de campo (ver README.md), sempre contra a central física ou em ambiente de homologação com central real.

## Convenções

- Horário da central é interpretado como UTC-3, independente do fuso do processo/host — não assumir `Date` local sem checar essa conversão.
- Relay de push (`services/push-relay.service.ts`) é assíncrono e não bloqueia o loop principal — nunca fazer `await` direto no caminho crítico de leitura de estado da central.
- Cooldown de notificação (`CIE_PUSH_FIRE_ALARM_COOLDOWN_MS`, `CIE_PUSH_FAILURE_ALARM_COOLDOWN_MS`) existe para evitar flood — respeitar ao adicionar novos gatilhos de notificação.
- `CIE_DISCOVERY_ENABLED` e `CIE_RESTART_WATCHDOG_ENABLED` devem ficar `false` em Docker no Windows (recomendação documentada, já causou instabilidade quando ligados).

## Outros serviços do ecossistema

- `nova-api`: recebe o relay de push em `POST {MAIN_API_BASE_URL}/v2/api/push/events/fire-alarm`.
- `nova-tag`: sem relação direta.
- `FRONT`: consome esta API indiretamente via `nova-api` (gateway `/v2/api/cie/*`), não diretamente.
