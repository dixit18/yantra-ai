// 3D-first contract: every story declares its 3D requirements HERE before any
// platform/integration code lands — named subsystem nodes, camera per step,
// annotation copy, beacon state. See README.md (3D pipeline).
export const SUBSYSTEMS = [
  'frame',
  'conveyor',
  'hopper',
  'control-panel',
  'beacon',
  'sensor',
] as const;
export type Subsystem = (typeof SUBSYSTEMS)[number];

export const STORY_STEPS = ['scan', 'identify', 'diagnose', 'act'] as const;
export type StoryStepId = (typeof STORY_STEPS)[number];

export type StatusLight = 'amber' | 'red' | 'green';

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
}

export interface StoryStepDef {
  id: StoryStepId;
  eyebrow: string;
  title: string;
  body: string;
  focusNode: Subsystem | null;
  camera: CameraPreset;
  beacon: StatusLight;
  screen: StatusLight;
}

export const HERO_STEPS: readonly StoryStepDef[] = [
  {
    id: 'scan',
    eyebrow: '01 — Scan',
    title: 'Scan the machine.',
    body: 'A QR deep link resolves tenant, site, serial, revision, and installed options before a single question is asked.',
    focusNode: null,
    camera: { position: [6.0, 3.4, 6.0], target: [0, 1.0, 0] },
    beacon: 'amber',
    screen: 'amber',
  },
  {
    id: 'identify',
    eyebrow: '02 — Identify',
    title: 'Know the exact configuration.',
    body: 'Model, revision, and option codes scope every answer to the unit in front of the technician — never a generic manual.',
    focusNode: 'control-panel',
    camera: { position: [2.7, 2.1, 3.5], target: [0.9, 1.4, -0.2] },
    beacon: 'amber',
    screen: 'amber',
  },
  {
    id: 'diagnose',
    eyebrow: '03 — Diagnose',
    title: 'Follow approved steps, with evidence.',
    body: 'Fault codes map to manufacturer-approved procedures. Each step cites document, version, and page — or the case escalates.',
    focusNode: 'beacon',
    camera: { position: [5.3, 3.1, 4.3], target: [0.2, 1.15, 0] },
    beacon: 'red',
    screen: 'red',
  },
  {
    id: 'act',
    eyebrow: '04 — Act',
    title: 'Move to part, case, or quote.',
    body: 'Compatible parts, a service case, or an RFQ draft — created with the full machine context attached, never retyped.',
    focusNode: 'conveyor',
    camera: { position: [4.7, 2.7, 4.7], target: [0, 0.9, 0] },
    beacon: 'green',
    screen: 'green',
  },
];

export function stepById(id: StoryStepId): StoryStepDef {
  const step = HERO_STEPS.find((s) => s.id === id);
  if (!step) {
    throw new Error(`unknown story step: ${id}`);
  }
  return step;
}

export function nextStep(id: StoryStepId): StoryStepId {
  const at = STORY_STEPS.indexOf(id);
  return STORY_STEPS[(at + 1) % STORY_STEPS.length] as StoryStepId;
}

export function prevStep(id: StoryStepId): StoryStepId {
  const at = STORY_STEPS.indexOf(id);
  return STORY_STEPS[(at - 1 + STORY_STEPS.length) % STORY_STEPS.length] as StoryStepId;
}

// Emphasis for status lights (beacon dome, panel screen): selection beats
// story focus beats rest state. Pure so the rule stays unit-tested; the scene
// applies it, never the reverse.
export function statusLightIntensity(base: number, selected: boolean, focused: boolean): number {
  if (selected) {
    return base + 1.1;
  }
  if (focused) {
    return base + 0.8;
  }
  return base;
}

export const SUBSYSTEM_INFO: Record<Subsystem, { label: string; blurb: string }> = {
  frame: {
    label: 'Base frame',
    blurb: 'Structural base of the demo unit. Select a subsystem to inspect it.',
  },
  conveyor: {
    label: 'Conveyor',
    blurb: 'Moves packs through the line. The act step stages compatible spares here.',
  },
  hopper: {
    label: 'Hopper',
    blurb: 'Holds product upstream of the fill station on the demo unit.',
  },
  'control-panel': {
    label: 'Control panel',
    blurb: 'Displays fault codes and machine state. Diagnosis starts here.',
  },
  beacon: {
    label: 'Beacon',
    blurb: 'Amber running · red fault · green resolved. Mirrors the story step.',
  },
  sensor: {
    label: 'Sensor post',
    blurb: 'Reads pack presence at the gate. A blocked beam raises the demo fault.',
  },
};
