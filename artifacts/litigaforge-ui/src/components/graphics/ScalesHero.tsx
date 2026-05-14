export function ScalesHero({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <filter id="glow-gold" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-node" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="beam-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="scale-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Background radial glow */}
      <ellipse cx="260" cy="210" rx="180" ry="150" fill="url(#center-glow)" />

      {/* Outer ring */}
      <circle cx="260" cy="210" r="155" stroke="#fbbf24" strokeOpacity="0.06" strokeWidth="1" />
      <circle cx="260" cy="210" r="125" stroke="#fbbf24" strokeOpacity="0.09" strokeWidth="0.5" strokeDasharray="4 8" />

      {/* Network spokes — radiating lines to nodes */}
      {[
        [260, 55], [390, 95], [430, 230], [370, 355], [150, 355], [90, 230], [130, 95]
      ].map(([nx, ny], i) => (
        <line
          key={i}
          x1="260" y1="210"
          x2={nx} y2={ny}
          stroke="#fbbf24"
          strokeOpacity="0.12"
          strokeWidth="0.8"
          strokeDasharray="3 6"
        >
          <animate attributeName="strokeDashoffset" from="0" to="-18" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
        </line>
      ))}

      {/* Outer network nodes */}
      {[
        { cx: 260, cy: 55, label: "eCourts", delay: "0s" },
        { cx: 390, cy: 95, label: "GSTIN", delay: "0.4s" },
        { cx: 430, cy: 230, label: "VAHAN", delay: "0.8s" },
        { cx: 370, cy: 355, label: "PAN", delay: "1.2s" },
        { cx: 150, cy: 355, label: "SARATHI", delay: "1.6s" },
        { cx: 90, cy: 230, label: "DigiLocker", delay: "2.0s" },
        { cx: 130, cy: 95, label: "MEE SEVA", delay: "2.4s" },
      ].map(({ cx, cy, label, delay }) => (
        <g key={label} filter="url(#glow-node)">
          <circle cx={cx} cy={cy} r="20" fill="#fbbf24" fillOpacity="0.05" stroke="#fbbf24" strokeOpacity="0.25" strokeWidth="1">
            <animate attributeName="fillOpacity" values="0.05;0.12;0.05" dur="3s" begin={delay} repeatCount="indefinite" />
          </circle>
          <circle cx={cx} cy={cy} r="3.5" fill="#fbbf24" fillOpacity="0.7" />
          <text x={cx} y={cy + 32} textAnchor="middle" fill="#fbbf24" fillOpacity="0.45" fontSize="8" fontFamily="JetBrains Mono, monospace" letterSpacing="0.5">
            {label}
          </text>
        </g>
      ))}

      {/* Cross-connections between nodes */}
      {[
        [260, 55, 390, 95], [390, 95, 430, 230], [430, 230, 370, 355],
        [150, 355, 90, 230], [90, 230, 130, 95], [130, 95, 260, 55],
        [260, 55, 430, 230], [390, 95, 150, 355],
      ].map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#fbbf24" strokeOpacity="0.05" strokeWidth="0.5"
        />
      ))}

      {/* Horizontal crossbeam of scales */}
      <rect x="195" y="147" width="130" height="3" rx="1.5" fill="url(#scale-grad)" filter="url(#glow-gold)" />

      {/* Center vertical pillar */}
      <rect x="258.5" y="148" width="3" height="90" rx="1.5" fill="url(#scale-grad)" />

      {/* Center pivot diamond */}
      <path d="M260 143 L265 150 L260 157 L255 150 Z" fill="#fbbf24" filter="url(#glow-gold)" />

      {/* Left pan chain */}
      <line x1="210" y1="150" x2="210" y2="185" stroke="#fbbf24" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="2 3" />
      {/* Right pan chain */}
      <line x1="310" y1="150" x2="310" y2="175" stroke="#fbbf24" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="2 3" />

      {/* Left pan (tilted slightly) */}
      <ellipse cx="210" cy="192" rx="28" ry="8" fill="#fbbf24" fillOpacity="0.08" stroke="#fbbf24" strokeOpacity="0.45" strokeWidth="1.2" />
      <path d="M182 192 Q210 200 238 192" stroke="#fbbf24" strokeOpacity="0.5" strokeWidth="1" fill="none" />

      {/* Right pan (balanced) */}
      <ellipse cx="310" cy="182" rx="28" ry="8" fill="#fbbf24" fillOpacity="0.08" stroke="#fbbf24" strokeOpacity="0.45" strokeWidth="1.2" />
      <path d="M282 182 Q310 190 338 182" stroke="#fbbf24" strokeOpacity="0.5" strokeWidth="1" fill="none" />

      {/* Base */}
      <rect x="245" y="238" width="30" height="3" rx="1.5" fill="#fbbf24" fillOpacity="0.4" />
      <rect x="250" y="241" width="20" height="8" rx="1" fill="#fbbf24" fillOpacity="0.25" />

      {/* Data flow pulses along spokes */}
      {[
        { x1: 260, y1: 210, x2: 260, y2: 55 },
        { x1: 260, y1: 210, x2: 390, y2: 95 },
        { x1: 260, y1: 210, x2: 90, y2: 230 },
      ].map(({ x1, y1, x2, y2 }, i) => (
        <circle key={i} r="2.5" fill="#fbbf24" fillOpacity="0.8">
          <animateMotion
            dur={`${2.5 + i * 0.7}s`}
            repeatCount="indefinite"
            path={`M${x1},${y1} L${x2},${y2}`}
          />
          <animate attributeName="fillOpacity" values="0;0.8;0" dur={`${2.5 + i * 0.7}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* Central halo pulse */}
      <circle cx="260" cy="210" r="40" fill="none" stroke="#fbbf24" strokeOpacity="0.1" strokeWidth="30">
        <animate attributeName="r" values="38;55;38" dur="4s" repeatCount="indefinite" />
        <animate attributeName="strokeOpacity" values="0.1;0;0.1" dur="4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
