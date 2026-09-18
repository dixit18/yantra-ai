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
- 2026-09-18 (P1-REPO-001): pnpm 10.13.1 pinned (matches local toolchain;
  defeats the ancestor `C:\Users\Dell\package.json` yarn pin via nearest-config
  rule). Boring majors: eslint 9, vitest 3, TS ~5.8 (not TS 7 / eslint 10 —
  ecosystem-safe). Single-version policy via `catalog:` in
  `pnpm-workspace.yaml`. ESM (`NodeNext`) throughout; per-package
  `tsconfig.json` (noEmit, incl. tests) + `tsconfig.build.json` (emit, excl.
  tests). Owner-authored canonical docs + `neon.ts` are byte-stable
  (`.prettierignore`); prettier reformatting them was reverted.
- 2026-09-18 (critic NEEDS-WORK → fixed): `neon.ts` imports `@neon/config/v1`
  with no provider by owner mandate; exclusion from quality gates is by design,
  not accident — eslint ignores it (`eslint.config.mjs`) and no tsconfig
  includes it (per-package `include: ["src"]` only), so green gates are honest.
  Wiring (dep + `neon deploy`) is the named Neon-wiring follow-up after
  P1-ENV-002, not P1-REPO-001.
- 2026-09-18 (owner override): 3D pipeline promoted ahead of platform work.
  Every new story lands its 3D requirements FIRST (story def, nodes, camera,
  fallback in `packages/3d`); platform tasks (P1-ENV-002 onward) queue behind
  the 3D-perfect gate (canvas-or-poster, reduced-motion, no hijack, mobile,
  critic PASS). Backlog yaml untouched — order recorded here + STATUS.
- 2026-09-18 (3D pipeline): `@yantra/3d` declares `react`/`react-dom` as
  peerDeps, NOT devDeps — pnpm strictness caught the undeclared runtime dep
  (npm hoisting would have masked it); peers resolve to the app's single copy
  via the store, so hooks never see two reconcilers.
- 2026-09-18 (3D visuals, from screenshot review): body `#59616c` over
  `#3a4048` dark detail, ambient 1.15 + key 2.0, ground disc r 2.6; scan camera
  pulled to [6.0,3.4,6.0]; diagnose settled at [4.8,2.9,3.8]→[0.3,1.2,0] after
  the critic caught edge bleed — v4 screenshot confirms unclipped base. `beacon`/
  the critic caught edge bleed — v4 screenshot confirms unclipped base. `beacon`/
  `screen` emissive now scales with selection/focus via tested
  `statusLightIntensity()`. Final diagnose preset [5.3,3.1,4.3]→[0.2,1.15,0]
  (v5): machine fully in frame; floor disc may exit frame at the bottom —
  waived as natural studio-floor behavior (gate criterion is an unclipped
  subject, not a contained ellipse, which would forbid focus shots).
- 2026-09-18 (ops lesson): `pnpm start` orphans `next-server` when only the
  parent is killed — a zombie on :3100 served a stale `.next` (poster +
  dead stepper, zero pageerrors). Probes must free the port first and capture
  console errors + failed requests, not just pageerrors.
- 2026-09-18 (3D deps, one line each): `three` renders WebGL; `@react-three/fiber`
  is its declarative React reconciler (spec §7.6) instead of imperative scene
  code; `@react-three/drei` supplies tested OrbitControls instead of hand-rolled
  orbit math; `gsap` tweens camera moves with fixed duration/ease + kill-safe
  cleanup instead of ad-hoc useFrame lerps; `next@16` is the spec §8.3 App Router
  host; `react@19` is the Next/R3F peer line (fiber 9.7's `<19.3` peer warning
  noted — live canvas probe with zero page errors is the acceptance evidence);
  `@playwright/test` enforces the 3D-perfect gate in CI.
- Waived (critic-agreed): full-viewport hero whitespace is deliberate staging,
  not a void; the "best service engineer" headline is spec §7.4 verbatim.
- TODO: LICENSE choice for public repo; pre-commit secret scan (gitleaks).
