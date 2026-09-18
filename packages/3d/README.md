# @yantra/3d — 3D pipeline (3D-first contract)

Owner rule: **no story ships before its 3D requirements exist here.** Platform
and integration code queue behind the 3D-perfect gate.

## Adding a story's 3D (do this first)

1. Extend `src/story.ts`: step def (`eyebrow/title/body`), `focusNode` (one of
   `SUBSYSTEMS`, or `null` for the whole machine), `camera` preset, and
   `beacon`/`screen` light state. Copy stays operational — no hype, no invented
   specs.
2. If the story needs a new selectable part, add the node id to `SUBSYSTEMS`,
   a mass to `MachineModel` in `src/components.tsx`, a blurb in
   `SUBSYSTEM_INFO`, and the same outline to `MachinePoster` in
   `src/fallback.tsx`. Every clickable node resolves to info — never a dead end.
3. Camera motion: `CameraRig` tweens with GSAP (`power2.inOut`, 1.1s) and pauses
   idle orbit mid-tween. Reduced motion jumps straight to the preset.
4. Verify: `pnpm --filter @yantra/3d test`, web hero E2E (`pnpm e2e`), critic PASS.

## Conventions

- Synthetic demo unit is parametric (no binary asset, fully reviewable).
  Real OEM models arrive as GLB + Draco (`apps/web/public/models/*.glb`,
  hero first scene under ~2–3 MB) with mesh names matching `SUBSYSTEMS` ids,
  so the story machine, selection, and part-linking keep working unchanged.
- Canvas is lazy (`next/dynamic`, `ssr: false`); primary copy and CTAs are
  server-rendered and usable without the 3D bundle.
- Poster renders when: reduced motion, no WebGL, chunk loading, or no JS.
- Never trap scroll: `OrbitControls` has `enableZoom={false}` — rotate by drag
  only. No scroll hijack, ever.
- Budgets: hero GLB ~2–3 MB first scene, AVIF/WebP imagery, DPR capped at 2,
  `prefers-reduced-motion` honored, mid-range mobile stays interactive.
