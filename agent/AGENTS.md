# Yantra AI — Agent Operating Rules

Source of truth order: master spec → PRODUCT/ARCHITECTURE → ADRs → ROADMAP →
`yantra_ai_initial_backlog_LEAN_MVP.yaml` → STATUS.md.

## Autonomous loop

1. Read AGENTS + STATUS + BACKLOG + DECISIONS.
2. Validate repo health (install/build/test).
3. Pick highest-priority READY task with dependencies done.
4. Implement smallest coherent vertical slice (prod code, not mocks).
   3D-first: a story's 3D artifacts (story def, nodes, camera, fallback)
   land before its platform/integration code.
5. Run format/lint/typecheck/unit/integration + task acceptance tests.
   UI → Playwright desktop/mobile. AI → golden eval subset.
6. Self-review diff for security, tenancy, dead code.
7. **Mandatory Critic pass** (`agent/CRITIC.md`, opencode subagent `critic`).
   BLOCKED = fix + re-review. No task is done without PASS (or waiver + ADR).
8. Update docs/ADR/schema/API if contracts changed. Update STATUS + BACKLOG.
9. Atomic commit. Next task.

## Stop / human-gate conditions

Production secrets, paid spend, destructive prod migration, legal/compliance
claims, safety-policy broadening, real external customer sends, scope/security/
pricing changes, unresolvable requirement conflicts, gated production release.

Do not stop for unspecified implementation details — choose simplest reversible
design, record in DECISIONS.md.

## Taste bar (enforced by Critic)

Industrial, engineered, human-made. No neon-gradient AI-template look, no fake
proof, no hype copy, no placeholder-as-production. Citations, mono technical
tokens, deterministic rules, tenant isolation, auditability on every task.

## WIP rules

One primary task at a time. Max two repair attempts per strategy before
reassessing. Never weaken tests to pass. Keep main runnable after every merge.
New dependencies need DECISIONS.md justification.
