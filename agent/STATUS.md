# STATUS

- Phase: 1 (foundation)
- DB: Neon Postgres verified 2026-09-18 via `psql $DATABASE_URL`
  (password redacted): `select version()` → PostgreSQL 18.6;
  `pg_available_extensions` → vector 0.8.6 available, then
  `create extension if not exists vector` succeeded
  (`pg_extension` shows vector 0.8.6). `LOCAL_BLOB_ROOT=./data/uploads`
  created on disk.
- Neon CLI auth steps (`login/link/mcp/deploy`) skipped per owner instruction —
  using direct DB string; `neon.ts` is an unwired scaffold (`defineConfig({})`,
  `@neon/config` dep not yet installed — wired by the Neon-wiring follow-up
  after P1-ENV-002).
- Critic: `agent/CRITIC.md` + `.opencode/agent/critic.md` active; mandatory
  pre-done gate.
- GitHub: `dixit18/yantra-ai` (public), `main` pushed (aa10486);
  `.env` + live PAT file gitignored, verified absent from `git ls-files` and
  history; remote URL carries no token.
- P1-REPO-001 DONE 2026-09-18: pnpm 10.13.1 + turbo 2.10.13 monorepo,
  13 workspaces, each with build/typecheck/lint/test. Verified:
  `pnpm install` (+159 pkgs), `pnpm build` 13/13, `pnpm typecheck` 14/14,
  `pnpm lint` 13/13, `pnpm test` 14/14, `pnpm format:check` green.
  (typecheck/test show 14 tasks for 13 workspaces: the extra task is
  `@yantra/contracts#build`, pulled in via the `^build` edge because
  `@yantra/api` depends on it — confirmed with `turbo run typecheck --dry`.)
- 3D-FIRST DONE 2026-09-18: `packages/3d` pipeline (story machine,
  parametric demo unit, poster fallback, GSAP camera rig, zoom-off controls)
  - Next.js hero (SSR copy, lazy canvas, stepper, node info). Verified:
    `pnpm build/typecheck/lint/test` green, `pnpm e2e` 5/5 (content, stepper,
    reduced-motion poster, no scroll hijack, mobile), live probe canvas:1 with
    zero page errors, screenshot-reviewed twice.
- Platform tasks queue behind this gate (owner order); next: P1-ENV-002.
- Next ready: 3D pipeline (this task), then P1-ENV-002 (lean env validation —
  unblocked by P1-REPO-001) and
  P1-OBS-005 / P1-UI-006 / P1-CICD-009 per
  `yantra_ai_initial_backlog_LEAN_MVP.yaml`.
- Needs from human: MODEL_PROVIDER/MODEL_API_KEY/APP_SECRET when real AI calls
  begin; GitHub repo name confirmed `yantra-ai` (public).
