# AGENTS.md

## Purpose

This file is the operational guide for AI coding agents working in this repository.

Keep the working context minimal. Do not read large parts of the repository unless the task requires it.

Prefer local discovery over global exploration.

For project-specific context (what this service does, real architecture, hard rules, known bugs), see `CLAUDE.md` — read it first, always.

---

## Stack

- Runtime: Node.js 20
- Language: TypeScript
- HTTP framework: Express (`v2/`, current production, exposed at `/v1/api`) and Fastify (`v3/`, new, exposed at `/v3/api`)
- Validation: Zod (`v3/` only)
- Physical integration: TCP/UDP socket to the fire alarm central, via `core/native/CIE2500Native.ts` (a binding over vendored manufacturer SDK)
- Package manager: npm

---

## Repository Structure

```text
src/
├── core/           # Business logic, framework-agnostic — cie-manager.ts owns the SINGLE connection
├── v2/             # Express API — production surface, NEVER edit (see CLAUDE.md)
├── v3/             # Fastify + Zod API, feature-first modules
│   ├── health/
│   ├── cie/
│   └── shared/     # Truly cross-cutting only: response envelope, service-auth
├── intelbras/      # Vendored manufacturer SDK — DO NOT MODIFY
└── server.ts       # Entry point

docs/                          # workspace root, shared across all 4 projects
└── PADRAO-RESPOSTA-V3.md      # v3 response envelope, service auth, folder convention

AI-Friendly Architecture Specification.md   # workspace root — architectural rationale
```

Do not load `docs/PADRAO-RESPOSTA-V3.md` or the architecture spec unless the task touches `v3/`. Do not open `src/intelbras/` unless the task specifically requires understanding the vendor protocol.

---

## Context Strategy

For every task, minimize the amount of unrelated context loaded.

Use this discovery order:

1. Read `CLAUDE.md` (project context, hard rules, the `/v1/api` vs `/v3/api` note).
2. Identify whether the task is `core/`, `v2/`, or `v3/`.
3. Inspect files inside that area.
4. Check whether the module contains its own `AGENTS.md` (rare — only for modules with non-obvious protocol/security context).
5. Read `docs/PADRAO-RESPOSTA-V3.md` only when the task touches `v3/`.
6. Use repository-wide search when local discovery is insufficient.

Do not explore the entire repository by default.

---

## Core Architecture Rules

### Feature Locality

Inside `v3/`, keep feature-specific code inside its own folder (`cie/cie.routes.ts`, `cie/cie.schema.ts`). Do not distribute a `v3/` feature across global `routes/`/`controllers/` folders — that pattern was tried and reverted.

### Cohesion

Keep related code together. Separate code when responsibilities differ, not merely because a pattern allows another file.

### Progressive Complexity

Start with the simplest structure that correctly represents the domain. `v3/` began as `routes/` + `lib/` and was reorganized to feature folders only once there was enough real code to justify it.

### Boundaries

- `core/` never imports Express or anything from `v2/`.
- There is exactly **one** physical connection to the fire alarm central per process. `CieManager` is created once in `server.ts` and injected into both `v2/` and `v3/` — never instantiate a second one.
- `v2/` is the production surface. **Never edit it** — see the hard rule in `CLAUDE.md`.
- `src/intelbras/` is vendor code. Behavior changes go in `core/native/CIE2500Native.ts` (the binding), never in the vendored files themselves.

### Abstractions

Do not create interfaces, factories, or wrappers without concrete value.

---

## Shared Code

`v3/shared/` is reserved for code genuinely shared across `v3/` features (response envelope, service-auth). A schema used by only one route stays inside that route's folder — `cie/cie.schema.ts` is a good example, since only `cie/` uses it today.

Do not use `lib/` or `utils/` as generic dumping grounds.

---

## Naming

Prefer `<feature>.routes.ts`, `<feature>.schema.ts` inside `v3/`. Avoid vague names when a more specific name is possible.

---

## Scope Discipline

Keep changes focused on the requested task. Do not perform unrelated refactoring, rename unrelated files, or modify `v2/` as a side effect of a `v3/` change. Never edit `src/intelbras/` as part of an unrelated task.

---

## Validation

Before considering a change complete, run:

```bash
npx tsc --noEmit   # type check
npm run build      # full compile
```

**Do not run `npm run dev`/`npm start` against this repository locally.** This service connects to a real physical fire alarm central — running it outside the actual deployment risks conflicting with production and, more importantly, with a safety system. Validate with type-check and build only; if runtime behavior must be verified against the real central, that requires explicit user approval and typically happens on the deployed server, following the field validation runbook in `README.md`.

There is no lint or automated test suite configured in this project yet.

---

## Dependencies

Before adding a new dependency, verify the requirement cannot reasonably be implemented with what is already installed. Prefer established, maintained libraries.

---

## Comments

Comments explain **why**, not **what**. Non-obvious protocol/timezone constraints (UTC-3 central time, push cooldown, discovery/watchdog flags on Windows Docker) are already documented as comments near the affected code — follow that pattern.

---

## Error Handling

- Never hardcode credentials, log secrets, or log tokens.
- `v3/` error responses (401/403) are generic ("Não autorizado.") — never name the internal mechanism (env var, token name) in a response that could be publicly visible via Swagger.

---

## Security

Treat all external input as untrusted. Validate inputs at system boundaries (Zod in `v3/`).

`CIE_SERVICE_TOKEN` authenticates the `nova-api` gateway, not end users — this is a service-to-service credential, not a substitute for user authorization (which is `nova-api`'s responsibility).

This is a fire safety system. Commands that modify device state (silence, release, restart, sirens) require more caution than read-only monitoring — when migrating those to `v3/`, expect two-step confirmation for destructive commands (`alarm-general`, `restart`).

---

## Before Creating a New File

Ask:

1. Does this represent a distinct responsibility?
2. Could it remain coherently with existing code in the same feature folder?
3. Does separation improve context locality?

---

## Before Completing a Task

Verify:

- the requested behavior is implemented;
- `v2/` was not touched;
- `src/intelbras/` was not touched;
- `npx tsc --noEmit` passes;
- `npm run build` passes;
- the process was NOT run locally against real hardware;
- CHANGELOG.md was updated (see the `commit` skill for the full flow);
- documentation was updated when `v3/` structure or the response envelope changed.

---

## Primary Principle

When choosing between two implementations, prefer the one that allows a future developer or agent to understand and modify the feature while loading the least amount of unrelated context.

> Keep related code together.
> Preserve meaningful boundaries.
> Prefer explicit, simple structures.
> Load context progressively.
> Optimize for relevant context, not minimum file count.
