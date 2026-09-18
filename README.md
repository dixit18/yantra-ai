# Yantra AI — Lean MVP

Governed product specialist for machinery manufacturers. Lean MVP runs as a
modular monolith + PostgreSQL + pgvector + local BlobStore. No Redis/S3/
Temporal/Kafka/K8s until a measured trigger (see master spec §8.8).

## Docs

- `YANTRA_AI_AGENT_MASTER_SPEC_LEAN_MVP.md` — execution contract
- `yantra_ai_initial_backlog_LEAN_MVP.yaml` — machine-readable task graph
- `agent/AGENTS.md` — operating rules · `agent/CRITIC.md` — contrarian reviewer
- `agent/STATUS.md` · `agent/DECISIONS.md`

## Local bootstrap

Toolchain: Node 22 (`.nvmrc`) + pnpm 10.13.1. The repo root pins
`packageManager: pnpm@10.13.1`, so the plain `pnpm` command works here.

1. Copy env: `cp .env.example .env` and fill `DATABASE_URL`, `MODEL_PROVIDER`,
   `MODEL_API_KEY`, `APP_SECRET`.
2. Ensure Postgres has `create extension if not exists vector;`
3. Create the local blob root: `mkdir -p ./data/uploads`
   (`LOCAL_BLOB_ROOT=./data/uploads`).
4. `neon.ts` is an unwired scaffold (`defineConfig({})`). Neon-wiring
   follow-up (scheduled after P1-ENV-002): install `@neon/config`, keep the
   scaffold, acceptance is `neon deploy` planning/applying cleanly.

## Monorepo

pnpm workspaces + Turbo. Layout follows the master spec: `apps/web`,
`apps/console`, `apps/api`; `packages/{ui,contracts,db,auth,agent-core,
connectors,knowledge,evals,telemetry,config}`. Shared versions live in the
`catalog:` section of `pnpm-workspace.yaml`.

| Command             | What it runs                                                |
| ------------------- | ----------------------------------------------------------- |
| `pnpm install`      | install all workspaces                                      |
| `pnpm build`        | `turbo run build` (dep-ordered emit)                        |
| `pnpm typecheck`    | `turbo run typecheck` (`tsc --noEmit`)                      |
| `pnpm lint`         | `turbo run lint` (eslint, zero warns)                       |
| `pnpm test`         | `turbo run test` (vitest)                                   |
| `pnpm format:check` | prettier check (owner docs excluded, see `.prettierignore`) |

Every workspace ships a tiny real, tested seed (never a mock as production);
full implementations land in their backlog tasks. The `api → contracts`
workspace link proves cross-package build ordering.

## Quality gate

No task is done without a Critic pass (`BLOCKED` = fix + re-review).
The Critic blocks generic AI-template visuals, hype copy, fake proof,
ungrounded technical claims, and tenant/safety gaps.
