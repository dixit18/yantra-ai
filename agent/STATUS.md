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
- P1-ENV-002 DONE 2026-09-18: lean env contract (`validateLeanEnv` + redaction),
  injectable DB health check (`pg` only), blob-root guarantee, api `bootstrap()`
  with a no-scale-deps guard test. Verified: build 14/14, typecheck 18/18,
  lint 14/14, test 18/18, format clean; live Neon run → env valid, model mock,
  vector 0.8.6, server PostgreSQL 18.6 (redacted host only, zero secrets logged).
- Platform tasks queue behind this gate (owner order); next: P1-DB-003 (tenant
  schema + migrations, now unblocked).
- P1-DB-003 DONE 2026-09-18: tenant/app_user/role/permission/user_role/
  role_permission/audit_event schema (`0001_init`), owned migration runner
  (ordered, transactional, tracked, advisory-locked, checksummed), idempotent
  secret-free demo seed, `db migrate [-- --seed]` CLI. Hardened per critic:
  0002 composite junction FKs + audit trigger, 0003 audit RESTRICT, seed in one
  transaction. Verified: build 14/14, typecheck 18/18, lint 14/14, test 18/18,
  format clean; live Neon → 0001-0003 applied, seed twice (same ids,
  created true→false), cross-tenant junction rejected, audit update/delete
  rejected, tenant-with-history rejected, zero new litter (9→9 tenants).
- P1-AUTH-004 DONE 2026-09-18: HMAC request tokens (timing-safe verify, expiry),
  DB-loaded permissions (never in token), token-tenant re-check, throwing
  guards (`requirePermission`, `requireSameTenant`), framework-agnostic
  `authenticateRequest`. Verified: build 14/14, typecheck 18/18, lint 14/14,
  test 18/18, format clean; live adversarial → authenticate + 4 codes,
  cross-tenant/permission/forged/spoofed denials, zero litter (0 demo-auth rows).
- P1-CICD-009 DONE 2026-09-18: `.github/workflows/ci.yml` (frozen install +
  pnpm store cache, format/lint/typecheck/test/build, Playwright Chromium +
  e2e, audit high+, gitleaks). Dry-ran the exact sequence locally: all green;
  audit reports 2 moderate (vitest dev-only path traversal, below threshold).
  Gitleaks runs in CI only (history already verified clean at every commit).
  Branch protection live: required `ci` check (strict), admins not blocked —
  red CI blocks merge, verified via API response.
- P1-OBS-005 DONE 2026-09-18: JSON logger (level filter, scope, per-emit
  correlation, sink-failure counting), ALS correlation context, choke-point
  secret redaction (keys, message assignments, bearer values, DB URLs,
  prototype-key safe), typed `writeAuditEvent` (closed allowlist, caps,
  scrubbed payloads). Hardened per critic BLOCKED round. Verified: build
  14/14, typecheck 18/18, lint 14/14, test 18/18, format clean; live audit
  write+read rolled back (0 probe rows persist).
- P1-UI-006 DONE 2026-09-18: `@yantra/ui` design system (TOKENS + Button/Chip/
  Eyebrow/SiteMark/Shell, single-source shell.css, tokens↔CSS sync test) adopted
  by web (layout, page, hero). Verified: build 14/14, typecheck 19/19, lint
  14/14, test 19/19, format clean, e2e 9/9 (5 hero + 4 shell: landmarks, skip
  link, visible focus, nav), screenshot-reviewed, zero page errors.
- P1-WEB-007 DONE 2026-09-18: home narrative (problem, governance, lanes,
  knowledge, pilot), /product, /security (risk classes, controls, honest
  non-claims), /contact with validating demo-only form. Verified: build 14/14,
  typecheck 19/19, lint 14/14, test 19/19, format clean, e2e 16/16 (routes,
  validation, no-JS core, mobile), screenshots reviewed, zero page errors.
  Hardened per critic PASS round: a11y linkage, noscript fallback, cross-page
  anchor proof, repo-linked security claims (e2e 17/17).
  Note: P1-3D-008's acceptance is exceeded by the shipped 3D pipeline —
  recommend marking it done in the backlog.
- P2-OBJ-010 DONE 2026-09-18: `BlobStore` interface + `LocalFileBlobStore`
  (opaque ids, content-addressed layout, tenant-scoped dedupe, no path escape,
  no cross-tenant oracle) + `0004_blob_files` registry. Verified: build 15/15,
  typecheck 20/20, lint 15/15, test 20/20, format clean; live → roundtrip,
  dedupe (1 row), per-tenant isolation, traversal rejected, inconsistency
  detected, zero litter (0 demo-blob rows/tenants). Hardened per critic
  BLOCKED round: read-path hash verify, size cap, filename sanitize,
  case-folded dirs, 0005 CHECKs.
- P2-DOC-011 DONE 2026-09-18: document/version tables (`0006`, composite tenant
  FK, CHECK-bounded states), validated state machine + atomic replaceVersion,
  blob-linked immutable versions. Hardened per critic BLOCKED round: 0007
  composite blob FK + transition/immutability trigger, 0008 fixing the
  succession check the first version locked out (link lives on the new row —
  the guard itself proved it live). Verified: build 15/15, typecheck 21/21,
  lint 15/15, test 21/21, format clean; live → 0001-0008 applied, illegal
  jumps + direct-SQL bypasses + cross-tenant pointer rejected, supersession
  links/timestamps correct, zero litter. Follow-ups closed: 0009 re-records the
  guard with its machine-readable contract (anti-drift test requires all
  definitions to agree), blob GC policy recorded. Live evidence 2026-09-18:
  `select version from schema_migrations` →
  0001_init, 0002_junction_guards, 0003_audit_restrict, 0004_blob_files,
  0005_blob_checks, 0006_documents, 0007_document_guards, 0008_supersede_order,
  0009_transition_contract; `select count(*) … where slug like 'demo-doc-%'` → 0.
- Ready next: P2-PARSE-012 (PDF parser) per
  `yantra_ai_initial_backlog_LEAN_MVP.yaml`.
- Needs from human: MODEL_PROVIDER/MODEL_API_KEY/APP_SECRET when real AI calls
  begin; GitHub repo name confirmed `yantra-ai` (public).
