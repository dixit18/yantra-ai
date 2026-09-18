// P1-REPO-001 seed for P1-UI-006 — industrial tokens per master spec §7.3.
// Restrained palette: graphite structure, warm off-white surfaces, steel
// secondary, one safety accent; green/amber/red reserved for semantic state.
export const TOKENS = {
  color: {
    graphite: '#23272e',
    paper: '#faf7f1',
    steel: '#8a94a0',
    accent: '#e8590c',
    ok: '#2f9e44',
    warn: '#f08c00',
    danger: '#e03131',
  },
  font: {
    ui: 'Inter, system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
  },
} as const;
