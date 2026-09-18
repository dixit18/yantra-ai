# DECISIONS

- 2026-09-18: Use direct `DATABASE_URL` for Neon Postgres; skip `neon auth`
  browser login per owner. Revisit `neon link/config/deploy` when a Neon API
  key is available. (pgvector enabled, connection verified.)
- 2026-09-18: Add independent Contrarian Critic (`agent/CRITIC.md` +
  `.opencode/agent/critic.md`, edit-deny subagent) as mandatory pre-done gate
  to block AI-slop look and weak reasoning. Any divergence: repo `CRITIC.md` wins.
- 2026-09-18: `neon.ts` kept as the exact owner-specified scaffold
  (`defineConfig({})`); `@neon/config/v1` install + `neon deploy` wiring
  deferred to P1-REPO-001 (monorepo bootstrap). No new runtime dep yet.
- 2026-09-18: Critic permits read-only inspection (`bash: ask`, limited to
  `git status/diff/log`, file reads, redacted DB selects); reviewer never
  mutates. Resolves `bash: deny` vs re-review-evidence contradiction.
- 2026-09-18: Local-only GitHub PAT kept on disk per owner, gitignored, never
  committed. Rotate/revoke it after first push (it has been handled outside
  the repo). GitHub repo `yantra-ai`, public.
- TODO: LICENSE choice for public repo; pre-commit secret scan (gitleaks).
