import { motion } from "framer-motion";

// ─── Types (exported for workspace.tsx) ───────────────────────────────────────

export interface TwinProfile {
  twin_score:             number;
  total_sessions:         number;
  total_events:           number;
  active_days:            number;
  learning_enabled:       boolean;
  agent_scores:           Record<string, number>;
  suggestion_accepts:     Record<string, number>;
  suggestion_dismisses:   Record<string, number>;
  judgment_courts:        Record<string, number>;
  node_type_preferences:  Record<string, number>;
  top_agent:              string;
  summary_insights?:      Array<{ emoji: string; text: string }>;
  suppressed_types?:      Record<string, number>;
  draft_style_preference?: { top_section: string; total_copies: number; accept_rate: number } | null;
}

export interface CrossMatterData {
  connections: Array<{
    session_id:    number;
    title:         string;
    shared_topics: string[];
    updated_at:    string;
    argument_echo?: boolean;
  }>;
  patterns: Array<{
    node_type: string;
    count:     number;
    insight:   string;
  }>;
  recommendation: string | null;
  judgment_court_context?: {
    court:      string;
    count:      number;
    all_courts: Record<string, number>;
  } | null;
}

interface Props {
  profile:                     TwinProfile | null;
  crossMatter:                 CrossMatterData | null;
  isLoading:                   boolean;
  sessionReady:                boolean;
  onToggleLearning:            (enabled: boolean) => void;
  onReset:                     () => void;
  onRefresh:                   () => void;
  onOpenSession?:              (sessionId: number) => void;
  onReactivateSuggestionType?: (type: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAL   = "#14b8a6";
const FG     = "#e2e8f0";
const FGD    = "#94a3b8";
const FGS    = "#64748b";
const BORDER = "rgba(255,255,255,0.07)";
const CARD   = "rgba(255,255,255,0.025)";

const AGENTS: Array<{ id: string; label: string; emoji: string }> = [
  { id: "research",   label: "Research",       emoji: "🔍" },
  { id: "strategy",   label: "Strategy",       emoji: "⚡" },
  { id: "risk",       label: "Risk & Counter",  emoji: "🛡️" },
  { id: "drafting",   label: "Drafting",        emoji: "✍️" },
  { id: "predictive", label: "Predictive",      emoji: "🔮" },
];

const SUGGESTION_LABELS: Record<string, string> = {
  opportunity: "Opportunities",
  risk:        "Risk Flags",
  precedent:   "Precedents",
  pattern:     "Arg. Patterns",
  warning:     "Warnings",
};

const NODE_EMOJIS: Record<string, string> = {
  judgment: "⚖️", strategy: "💡", risk: "⚠️",
  argument: "🗣️", issue: "🏛️",  fact: "📋",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r    = 36;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 35 ? TEAL : "#f59e0b";
  const label = score >= 70 ? "Well-trained" : score >= 35 ? "Learning" : score >= 10 ? "Getting started" : "New";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <svg width={90} height={90} viewBox="0 0 92 92">
        <circle cx={46} cy={46} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        <circle
          cx={46} cy={46} r={r} fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s ease, stroke 0.4s" }}
        />
        <text x={46} y={43} textAnchor="middle" fill={FG} fontSize={19} fontWeight={800}
          fontFamily="'Space Grotesk', sans-serif">{score}</text>
        <text x={46} y={57} textAnchor="middle" fill={FGS} fontSize={8}
          fontFamily="'Space Grotesk', sans-serif">/ 100</text>
      </svg>
      <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
    </div>
  );
}

function AffinityBar({ label, emoji, score, isTop }: {
  label: string; emoji: string; score: number; isTop: boolean;
}) {
  const color = isTop ? "#10b981" : score >= 65 ? TEAL : score <= 35 ? "#f59e0b" : FGS;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, width: 18, textAlign: "center", flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: isTop ? color : FGD }}>
            {label}{isTop ? " ★" : ""}
          </span>
          <span style={{ fontSize: 9, color }}>{score}%</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            style={{ height: "100%", background: color, borderRadius: 2 }}
          />
        </div>
      </div>
    </div>
  );
}

function SecHead({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 8, fontWeight: 800, color: FGS,
      textTransform: "uppercase", letterSpacing: "0.09em",
      paddingBottom: 7, borderBottom: `1px solid ${BORDER}`,
      marginBottom: 9,
    }}>
      {title}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: "20px 14px", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <div style={{
        width: 90, height: 90, borderRadius: "50%",
        background: "rgba(255,255,255,0.05)",
        animation: "forge-pulse 1.6s ease-in-out infinite",
      }} />
      {[80, 60, 70, 50, 65].map((w, i) => (
        <div key={i} style={{
          height: 9, width: `${w}%`, borderRadius: 4,
          background: "rgba(255,255,255,0.04)",
          animation: "forge-pulse 1.6s ease-in-out infinite",
          animationDelay: `${i * 0.12}s`,
          alignSelf: "flex-start",
        }} />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PersonalTwinPanel({
  profile, crossMatter, isLoading, sessionReady,
  onToggleLearning, onReset, onRefresh, onOpenSession, onReactivateSuggestionType,
}: Props) {

  if (!sessionReady) {
    return (
      <div style={{ padding: "28px 16px", textAlign: "center", color: FGS, fontSize: 10.5, lineHeight: 1.7 }}>
        <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.35 }}>🧬</div>
        Open or create a workspace to<br />activate your Legal Twin.
      </div>
    );
  }

  if (isLoading && !profile) return <Skeleton />;

  if (!profile) {
    return (
      <div style={{ padding: "28px 16px", textAlign: "center", color: FGS, fontSize: 10.5, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 28, opacity: 0.35 }}>🧬</div>
        <div>Your Legal Twin hasn't started<br />learning yet.</div>
        <button onClick={onRefresh} style={{
          padding: "7px 18px", borderRadius: 7,
          background: "rgba(20,184,166,0.1)",
          border: "1px solid rgba(20,184,166,0.25)",
          color: TEAL, fontSize: 10, fontWeight: 700, cursor: "pointer",
        }}>
          Load Profile
        </button>
      </div>
    );
  }

  const hasActivity = profile.total_events > 0;
  const topAccepts  = Object.entries(profile.suggestion_accepts)
    .sort(([, a], [, b]) => b - a).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Twin Score Header ───────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 14px 14px",
        background: "linear-gradient(160deg, rgba(20,184,166,0.05), transparent)",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ScoreRing score={profile.twin_score} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: FG, marginBottom: 6, letterSpacing: "0.01em" }}>
              🧬 Legal Twin
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
              {[
                { label: "Matters",           val: profile.total_sessions },
                { label: "Active days",        val: profile.active_days   },
                { label: "Signals learned",    val: profile.total_events  },
              ].map(({ label, val }) => (
                <div key={label} style={{ fontSize: 9, color: FGS }}>
                  <span style={{ color: TEAL, fontWeight: 700 }}>{val}</span>{"  "}{label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Learning toggle */}
        <div style={{
          marginTop: 12, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "8px 10px",
          background: CARD, borderRadius: 8, border: `1px solid ${BORDER}`,
        }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: profile.learning_enabled ? FG : FGS }}>
              {profile.learning_enabled ? "✓ Learning On" : "✗ Learning Paused"}
            </div>
            <div style={{ fontSize: 8, color: FGS, marginTop: 1 }}>
              {profile.learning_enabled
                ? "Improving with every interaction"
                : "No new signals recorded"}
            </div>
          </div>
          <button
            onClick={() => onToggleLearning(!profile.learning_enabled)}
            style={{
              padding: "4px 11px", borderRadius: 6, cursor: "pointer",
              background: profile.learning_enabled
                ? "rgba(20,184,166,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${profile.learning_enabled ? "rgba(20,184,166,0.3)" : BORDER}`,
              color: profile.learning_enabled ? TEAL : FGS,
              fontSize: 9, fontWeight: 800,
            }}
          >
            {profile.learning_enabled ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      {/* ── What Your Twin Knows ────────────────────────────────────────────── */}
      {profile.summary_insights && profile.summary_insights.length > 0 && (
        <div style={{ padding: "13px 14px 11px", borderBottom: `1px solid ${BORDER}` }}>
          <SecHead title="What Your Twin Knows" />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {profile.summary_insights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.07 }}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 9,
                  padding: "8px 10px",
                  background: "rgba(20,184,166,0.04)",
                  border: "1px solid rgba(20,184,166,0.1)",
                  borderRadius: 8,
                }}
              >
                <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{insight.emoji}</span>
                <div style={{ fontSize: 9.5, color: FGD, lineHeight: 1.6 }}>{insight.text}</div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Agent Affinities ────────────────────────────────────────────────── */}
      <div style={{ padding: "13px 14px 11px", borderBottom: `1px solid ${BORDER}` }}>
        <SecHead title="Agent Affinities" />
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {AGENTS.map(a => (
            <AffinityBar
              key={a.id}
              label={a.label}
              emoji={a.emoji}
              score={profile.agent_scores[a.id] ?? 50}
              isTop={profile.top_agent === a.id && hasActivity}
            />
          ))}
        </div>
        {!hasActivity && (
          <div style={{ marginTop: 8, fontSize: 8, color: FGS, fontStyle: "italic" }}>
            Rate agent outputs with 👍/👎 to personalise these scores.
          </div>
        )}
      </div>

      {/* ── What Insights You Use Most ──────────────────────────────────────── */}
      {topAccepts.length > 0 && (
        <div style={{ padding: "13px 14px 11px", borderBottom: `1px solid ${BORDER}` }}>
          <SecHead title="Preferred Insight Types" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {topAccepts.map(([type, count]) => (
              <div key={type} style={{
                padding: "3px 9px", borderRadius: 12,
                background: "rgba(20,184,166,0.08)",
                border: "1px solid rgba(20,184,166,0.2)",
                fontSize: 8.5, fontWeight: 700, color: TEAL,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {SUGGESTION_LABELS[type] ?? type}
                <span style={{
                  background: "rgba(20,184,166,0.18)", borderRadius: 8,
                  padding: "1px 5px", fontSize: 7.5,
                }}>
                  {count}×
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Smart Recommendation ────────────────────────────────────────────── */}
      {crossMatter?.recommendation && (
        <div style={{ padding: "13px 14px 11px", borderBottom: `1px solid ${BORDER}` }}>
          <SecHead title="Smart Recommendation" />
          <div style={{
            padding: "10px 12px",
            background: "linear-gradient(135deg, rgba(20,184,166,0.06), rgba(14,116,144,0.04))",
            border: "1px solid rgba(20,184,166,0.18)",
            borderRadius: 8, fontSize: 9.5, color: FGD, lineHeight: 1.65,
          }}>
            💡 {crossMatter.recommendation}
          </div>
        </div>
      )}

      {/* ── Cross-Matter Connections ─────────────────────────────────────────── */}
      {crossMatter && crossMatter.connections.length > 0 && (
        <div style={{ padding: "13px 14px 11px", borderBottom: `1px solid ${BORDER}` }}>
          <SecHead title={`Cross-Matter Links (${crossMatter.connections.length})`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {crossMatter.connections.map(c => (
              <motion.div
                key={c.session_id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: "9px 10px",
                  background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 5 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: FG, lineHeight: 1.3, flex: 1 }}>
                    🗂️ {c.title}
                    {c.argument_echo && (
                      <span style={{
                        display: "inline-block", marginLeft: 6,
                        padding: "1px 5px", borderRadius: 5,
                        background: "rgba(168,85,247,0.12)",
                        border: "1px solid rgba(168,85,247,0.28)",
                        fontSize: 7, fontWeight: 800, color: "#c084fc",
                        letterSpacing: "0.04em", verticalAlign: "middle",
                      }}>
                        ≋ ECHO
                      </span>
                    )}
                  </div>
                  {onOpenSession && (
                    <button
                      onClick={() => onOpenSession(c.session_id)}
                      style={{
                        background: "rgba(20,184,166,0.08)",
                        border: "1px solid rgba(20,184,166,0.22)",
                        borderRadius: 5, padding: "3px 8px",
                        color: TEAL, fontSize: 8.5, fontWeight: 700,
                        cursor: "pointer", flexShrink: 0, marginLeft: 7,
                      }}
                    >→ Open</button>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {c.shared_topics.map(topic => (
                    <span key={topic} style={{
                      padding: "2px 7px", borderRadius: 9,
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      fontSize: 7.5, fontWeight: 700, color: "#a5b4fc",
                    }}>
                      {topic}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Your Work Patterns ──────────────────────────────────────────────── */}
      {crossMatter && crossMatter.patterns.length > 0 && (
        <div style={{ padding: "13px 14px 11px", borderBottom: `1px solid ${BORDER}` }}>
          <SecHead title="Your Work Patterns" />
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {crossMatter.patterns.map(p => (
              <div key={p.node_type} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: "rgba(20,184,166,0.08)",
                  border: "1px solid rgba(20,184,166,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12,
                }}>
                  {NODE_EMOJIS[p.node_type] ?? "📋"}
                </div>
                <div style={{ fontSize: 9.5, color: FGD, lineHeight: 1.55, paddingTop: 3 }}>
                  {p.insight}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Judgment Court Footprint ─────────────────────────────────────────── */}
      {crossMatter?.judgment_court_context && (
        <div style={{ padding: "13px 14px 11px", borderBottom: `1px solid ${BORDER}` }}>
          <SecHead title="Your Judgment Footprint" />
          <div style={{
            padding: "9px 12px",
            background: "rgba(99,102,241,0.04)",
            border: "1px solid rgba(99,102,241,0.15)",
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 9.5, color: FGD, lineHeight: 1.65 }}>
              <span style={{ fontWeight: 700, color: "#a5b4fc" }}>
                {crossMatter.judgment_court_context.court}
              </span>
              {" "}is your most-cited forum (
              {crossMatter.judgment_court_context.count} judgment
              {crossMatter.judgment_court_context.count !== 1 ? "s" : ""}).
              {" "}Agents prioritise its precedents in future analyses.
            </div>
            {Object.keys(crossMatter.judgment_court_context.all_courts).length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
                {Object.entries(crossMatter.judgment_court_context.all_courts).map(([court, cnt]) => (
                  <span key={court} style={{
                    padding: "2px 7px", borderRadius: 9,
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.18)",
                    fontSize: 7.5, fontWeight: 700, color: "#a5b4fc",
                  }}>
                    {court} ({cnt})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Empty cross-matter state ─────────────────────────────────────────── */}
      {crossMatter && crossMatter.connections.length === 0 && crossMatter.patterns.length === 0 && !crossMatter.judgment_court_context && (
        <div style={{ padding: "13px 14px 11px", borderBottom: `1px solid ${BORDER}` }}>
          <SecHead title="Cross-Matter Intelligence" />
          <div style={{ fontSize: 9, color: FGS, lineHeight: 1.7 }}>
            Work on a few more matters and the twin will surface thematic connections, reusable argument patterns, and strategic carry-overs automatically.
          </div>
        </div>
      )}

      {/* ── Reduced Visibility (Step 4: suppressed suggestion types) ─────────── */}
      {profile.suppressed_types && Object.keys(profile.suppressed_types).length > 0 && (
        <div style={{ padding: "13px 14px 11px", borderBottom: `1px solid ${BORDER}` }}>
          <SecHead title="Reduced Visibility" />
          <div style={{ fontSize: 8.5, color: FGS, lineHeight: 1.6, marginBottom: 9 }}>
            These suggestion types are hidden after 3+ dismissals. Undo to re-enable them.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(profile.suppressed_types).map(([type, count]) => (
              <div key={type} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "6px 10px",
                background: "rgba(239,68,68,0.04)",
                border: "1px solid rgba(239,68,68,0.12)",
                borderRadius: 7,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9.5, color: "#fca5a5" }}>
                    {SUGGESTION_LABELS[type] ?? type}
                  </span>
                  <span style={{
                    fontSize: 7.5, color: FGS,
                    padding: "1px 5px", borderRadius: 4,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    dismissed {count}×
                  </span>
                </div>
                {onReactivateSuggestionType && (
                  <button
                    onClick={() => onReactivateSuggestionType(type)}
                    style={{
                      background: "rgba(20,184,166,0.08)",
                      border: "1px solid rgba(20,184,166,0.22)",
                      borderRadius: 5, padding: "3px 8px",
                      color: TEAL, fontSize: 8, fontWeight: 700,
                      cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    ↩ Undo
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Privacy & Control ───────────────────────────────────────────────── */}
      <div style={{ padding: "13px 14px 18px" }}>
        <SecHead title="Privacy & Data Control" />
        <div style={{ fontSize: 8.5, color: FGS, lineHeight: 1.65, marginBottom: 11 }}>
          Your twin learns only from your in-Forge actions — agent ratings, accepted suggestions, and judgment additions. No case text or personal data is stored for learning purposes.
        </div>
        <button
          onClick={onReset}
          style={{
            width: "100%", padding: "8px",
            borderRadius: 7,
            background: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.18)",
            color: "#f87171", fontSize: 9.5, fontWeight: 700, cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.05)"; }}
        >
          🗑️ Reset All Learning Data
        </button>
      </div>

    </div>
  );
}
