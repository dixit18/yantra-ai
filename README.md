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

1. Copy env: `cp .env.example .env` and fill `DATABASE_URL`, `MODEL_PROVIDER`,
   `MODEL_API_KEY`, `APP_SECRET`.
2. Ensure Postgres has `create extension if not exists vector;`
3. Create the local blob root: `mkdir -p ./data/uploads`
   (`LOCAL_BLOB_ROOT=./data/uploads`).
4. `neon.ts` is an unwired scaffold (`defineConfig({})`) until P1-REPO-001
   installs `@neon/config` and wires `neon deploy`.

## Quality gate

No task is done without a Critic pass (`BLOCKED` = fix + re-review).
The Critic blocks generic AI-template visuals, hype copy, fake proof,
ungrounded technical claims, and tenant/safety gaps.
