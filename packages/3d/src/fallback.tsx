// Static poster: renders when motion is reduced, WebGL is missing, the 3D chunk
// is still loading, or JS is off. Same palette, same machine, zero JS cost.
export interface MachinePosterProps {
  serial?: string;
}

export function MachinePoster({ serial = 'SN YAN-PH-2041 · REV C' }: MachinePosterProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      role="img"
      aria-label={`Line illustration of the demo packaging machine, ${serial}`}
      data-testid="machine-poster"
    >
      <title>Demo packaging machine — static illustration</title>
      <g stroke="#23272e" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <line x1="20" y1="252" x2="380" y2="252" />
        {/* frame */}
        <rect x="60" y="206" width="200" height="16" fill="#3a4048" />
        <line x1="76" y1="222" x2="76" y2="250" />
        <line x1="244" y1="222" x2="244" y2="250" />
        {/* conveyor */}
        <rect x="70" y="168" width="150" height="12" fill="#23272e" />
        <circle cx="95" cy="174" r="5" />
        <circle cx="145" cy="174" r="5" />
        <circle cx="195" cy="174" r="5" />
        {/* hopper */}
        <polygon points="90,80 170,80 148,128 112,128" fill="#3a4048" />
        <rect x="122" y="128" width="16" height="22" />
        {/* control cabinet */}
        <rect x="282" y="122" width="70" height="100" fill="#3a4048" />
        <rect x="290" y="134" width="54" height="34" fill="#f08c00" stroke="none" />
        {/* beacon */}
        <line x1="317" y1="122" x2="317" y2="104" />
        <circle cx="317" cy="96" r="7" fill="#f08c00" />
        {/* sensor post */}
        <line x1="248" y1="222" x2="248" y2="150" />
        <rect x="238" y="140" width="20" height="12" fill="#3a4048" />
      </g>
      <text x="60" y="272" fontFamily="'IBM Plex Mono', monospace" fontSize="12" fill="#8a94a0">
        {serial}
      </text>
      <text x="60" y="290" fontFamily="'IBM Plex Mono', monospace" fontSize="11" fill="#8a94a0">
        INTERACTIVE DEMO — SYNTHETIC UNIT
      </text>
    </svg>
  );
}
