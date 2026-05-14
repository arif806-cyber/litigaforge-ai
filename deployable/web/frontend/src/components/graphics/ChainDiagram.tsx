const STAGES = [
  { id: "INPUT", label: "Case Input", color: "#fbbf24" },
  { id: "NLP", label: "Entity Extract", color: "#818cf8" },
  { id: "ROUTE", label: "Chain Router", color: "#34d399" },
  { id: "API", label: "API Chains", color: "#60a5fa" },
  { id: "AI", label: "AI Synthesis", color: "#f472b6" },
  { id: "OUT", label: "Strategy", color: "#fbbf24" },
];

export function ChainDiagram({ className = "" }: { className?: string }) {
  const W = 600;
  const H = 80;
  const nodeW = 80;
  const nodeH = 44;
  const spacing = (W - nodeW) / (STAGES.length - 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {STAGES.map(({ id, color }) => (
          <filter key={id} id={`ng-${id}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
        <filter id="pipe-glow" x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Connector pipes */}
      {STAGES.slice(0, -1).map((s, i) => {
        const x1 = i * spacing + nodeW;
        const x2 = (i + 1) * spacing;
        const cy = H / 2;
        const nextColor = STAGES[i + 1].color;
        return (
          <g key={i}>
            <line x1={x1} y1={cy} x2={x2} y2={cy} stroke="#ffffff" strokeOpacity="0.06" strokeWidth="2" />
            {/* Animated data pulse */}
            <circle r="3" fill={s.color} fillOpacity="0.9" filter={`url(#ng-${s.id})`}>
              <animateMotion
                dur={`${1.5 + i * 0.2}s`}
                begin={`${i * 0.35}s`}
                repeatCount="indefinite"
                path={`M${x1},${cy} L${x2},${cy}`}
              />
              <animate attributeName="fillOpacity" values="0;1;0" dur={`${1.5 + i * 0.2}s`} begin={`${i * 0.35}s`} repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}

      {/* Nodes */}
      {STAGES.map(({ id, label, color }, i) => {
        const cx = i * spacing + nodeW / 2;
        const cy = H / 2;
        return (
          <g key={id}>
            {/* Outer glow ring */}
            <circle cx={cx} cy={cy} r={nodeH / 2 + 4} fill={color} fillOpacity="0.04">
              <animate attributeName="fillOpacity" values="0.04;0.1;0.04" dur="2.5s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
            </circle>
            {/* Node box */}
            <rect
              x={cx - nodeW / 2}
              y={cy - nodeH / 2}
              width={nodeW}
              height={nodeH}
              rx="6"
              fill="#0a0a15"
              stroke={color}
              strokeOpacity="0.4"
              strokeWidth="1.2"
            />
            {/* Colored top accent bar */}
            <rect
              x={cx - nodeW / 2 + 8}
              y={cy - nodeH / 2}
              width={nodeW - 16}
              height="2.5"
              rx="1.25"
              fill={color}
              fillOpacity="0.7"
            />
            {/* ID label */}
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fill={color}
              fillOpacity="0.9"
              fontSize="8"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
              letterSpacing="1"
            >
              {id}
            </text>
            {/* Description */}
            <text
              x={cx}
              y={cy + 9}
              textAnchor="middle"
              fill="white"
              fillOpacity="0.4"
              fontSize="7"
              fontFamily="JetBrains Mono, monospace"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
