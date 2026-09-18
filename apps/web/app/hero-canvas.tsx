'use client';
import { HeroScene } from '@yantra/3d';
import type { StoryStepDef, Subsystem } from '@yantra/3d';

// Thin dynamic-import boundary: the Canvas (and three.js) only loads here,
// behind next/dynamic with ssr:false in hero-section.
export interface HeroCanvasProps {
  step: StoryStepDef;
  selected: Subsystem | null;
  onSelect: (id: Subsystem | null) => void;
}

export function HeroCanvas(props: HeroCanvasProps) {
  return <HeroScene {...props} />;
}
