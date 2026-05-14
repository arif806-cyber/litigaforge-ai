export function EmptyStateArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <filter id="es-glow">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="es-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background glow */}
      <ellipse cx="140" cy="110" rx="110" ry="90" fill="url(#es-bg)" />

      {/* Outer dashed circle */}
      <circle cx="140" cy="110" r="85" stroke="#fbbf24" strokeOpacity="0.1" strokeWidth="1" strokeDasharray="5 8" />

      {/* Document stack */}
      <rect x="95" y="65" width="60" height="80" rx="4" fill="#fbbf24" fillOpacity="0.04" stroke="#fbbf24" strokeOpacity="0.15" strokeWidth="1.2" />
      <rect x="99" y="61" width="60" height="80" rx="4" fill="#fbbf24" fillOpacity="0.04" stroke="#fbbf24" strokeOpacity="0.12" strokeWidth="1" />
      <rect x="103" y="57" width="60" height="80" rx="4" fill="#0f0f1a" stroke="#fbbf24" strokeOpacity="0.2" strokeWidth="1.2" />

      {/* Lines on document */}
      <rect x="113" y="72" width="40" height="2" rx="1" fill="#fbbf24" fillOpacity="0.3" />
      <rect x="113" y="80" width="30" height="2" rx="1" fill="#fbbf24" fillOpacity="0.18" />
      <rect x="113" y="88" width="35" height="2" rx="1" fill="#fbbf24" fillOpacity="0.18" />
      <rect x="113" y="96" width="22" height="2" rx="1" fill="#fbbf24" fillOpacity="0.12" />

      {/* Quill/pen */}
      <line x1="148" y1="120" x2="128" y2="138" stroke="#fbbf24" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M148 120 C152 112 158 108 162 112 C158 116 154 120 148 120Z" fill="#fbbf24" fillOpacity="0.3" stroke="#fbbf24" strokeOpacity="0.5" strokeWidth="0.8" />
      <line x1="128" y1="138" x2="126" y2="142" stroke="#fbbf24" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />

      {/* Tiny scales icon below */}
      <rect x="127" y="163" width="26" height="1.5" rx="0.75" fill="#fbbf24" fillOpacity="0.3" filter="url(#es-glow)" />
      <rect x="139.25" y="164.5" width="1.5" height="14" rx="0.75" fill="#fbbf24" fillOpacity="0.25" />
      <ellipse cx="130" cy="175" rx="7" ry="2.5" fill="#fbbf24" fillOpacity="0.1" stroke="#fbbf24" strokeOpacity="0.3" strokeWidth="0.8" />
      <ellipse cx="150" cy="173" rx="7" ry="2.5" fill="#fbbf24" fillOpacity="0.1" stroke="#fbbf24" strokeOpacity="0.3" strokeWidth="0.8" />
      <line x1="130" y1="164.5" x2="130" y2="172.5" stroke="#fbbf24" strokeOpacity="0.25" strokeWidth="0.8" />
      <line x1="150" y1="164.5" x2="150" y2="170.5" stroke="#fbbf24" strokeOpacity="0.25" strokeWidth="0.8" />

      {/* Floating dots */}
      {[
        { cx: 62, cy: 75, r: 2, delay: "0s" },
        { cx: 218, cy: 85, r: 1.5, delay: "0.8s" },
        { cx: 70, cy: 155, r: 2, delay: "1.5s" },
        { cx: 210, cy: 160, r: 1.5, delay: "0.4s" },
        { cx: 140, cy: 38, r: 1.5, delay: "1s" },
      ].map(({ cx, cy, r, delay }, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#fbbf24" fillOpacity="0.2">
          <animate attributeName="fillOpacity" values="0.2;0.5;0.2" dur="3s" begin={delay} repeatCount="indefinite" />
          <animate attributeName="cy" values={`${cy};${cy - 4};${cy}`} dur="4s" begin={delay} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}
