# cie2500-api

API de integração com a central de incêndio Intelbras CIE2500 (Condomínio Nova Residence). Node + TypeScript + Express 5.

## Comandos
- `npm run dev` — dev com `ts-node-dev` (usa `.env`), porta 4021.
- `npm run build` / `npm start` — compila para `dist/` e roda `dist/server.js`.
- Swagger em `/swagger`.

## Arquitetura
- Todas as rotas ficam sob o prefixo **`/v1/api`** (`/health`, `/cie/panel`, `/cie/status`, `/cie/alarms/active`, `/cie/logs`, `/cie/counters/*`, `/cie/commands/*`).
- `src/services/`: `cie-state` (polling/estado da central), `cie-log` (ring buffer de logs, normalização), `cie-command` (comandos), `push-relay` (push para a API principal, com cooldown).
- Botões dos comandos e cooldowns são configurados por env (`CIE_CMD_*`, `CIE_PUSH_*`); ver `.env.example`.
- `/cie/panel` devolve `latestFailureEvent` e `latestAlarmEvent`; o front usa os dois.

## Fluxo em produção
front (`nova-front`, container :8080) → `nova-api` (container :3030, `/v2/api/cie/*`, gateway em `CIE_GATEWAY_BASE_URL`) → esta API (container `nova-cie` :4021) → central `192.168.0.4`.
O push de alarme/falha vai para `MAIN_API_BASE_URL` (`/v2/api/push/send`) e chega em **usuários reais**.

## Cuidados ao testar neste servidor
- O container `nova-cie` ocupa a porta 4021 (e UDP 12345-12347). Para rodar `npm run dev` é preciso **parar o container** (`docker stop nova-cie`) e religar depois (`docker start nova-cie`). Isso tira a integração de produção do ar.
- Os comandos `POST /cie/commands/*` agem na central real (sirene, alarme geral, reinício). Não disparar sem combinar com o usuário.
- Disparo de alarme e falha geram push real para moradores (cooldown de 60 s por tipo).
- Falhas/alarmes são testados fisicamente (desconectar/acionar botoeira), sem comando de API.

## Fuso horário
A central envia data/hora local de Brasília. `cie-log.service.ts` converte com deslocamento fixo UTC-3 (`localCieTimeToIso`), independente do `TZ` do processo; o compose também define `TZ=America/Sao_Paulo`. Não voltar a usar `new Date(y, m, d, ...)` para essas datas (o container roda em UTC e o horário aparecia 3 h a menos).

## Mocks
`mock/` guarda respostas reais dos GETs em três cenários: `normal-*`, `falha-*` (botoeira desconectada) e `disparo-*` (botoeira acionada).

## Convenções
- Commits em português no estilo `feat:` / `fix:` / `chore:`.
- Push direto na `main`.
