import { useState } from "react";

const DOMAIN = "5672aa28-effd-46a3-88fe-a3ec3abfa9c9-00-21siwpka75hb0.pike.replit.dev";

const cases = [
  { id: 1, title: "Property Distribution — Khammam", type: "Property", stage: "arguments", health: 82, hearing: "25 Jun", lawyer: "Adv. Ramesh", priority: "high" },
  { id: 2, title: "Land Registration Issue", type: "Revenue", stage: "evidence", health: 67, hearing: "02 Jul", lawyer: "Adv. Priya", priority: "medium" },
  { id: 3, title: "Sale Agreement Dispute", type: "Civil", stage: "filed", health: 91, hearing: "18 Jul", lawyer: "Unassigned", priority: "low" },
];

const STAGES = ["filed", "admitted", "evidence", "arguments", "reserved", "judgment"];

const matches = [
  { name: "Adv. Ramesh K.", score: 96, specialty: "Property Law", exp: 15, tag: "Top Match" },
  { name: "Adv. Suresh M.", score: 92, specialty: "Civil Law", exp: 12, tag: "Great Match" },
  { name: "Adv. Priya N.", score: 89, specialty: "Litigation", exp: 10, tag: "Good Match" },
];

const insights = [
  { label: "Missing Document", detail: "Upload EC for Case #1", icon: "📎", color: "from-rose-500/20 to-rose-600/5" },
  { label: "Hearing in 3 days", detail: "Property case — District Court", icon: "⏰", color: "from-amber-500/20 to-amber-600/5" },
  { label: "Match Pending", detail: "2 lawyers await your response", icon: "⚖️", color: "from-emerald-500/20 to-emerald-600/5" },
];

const navItems = [
  { icon: "▣", label: "Dashboard", active: true },
  { icon: "📁", label: "My Cases" },
  { icon: "⚖️", label: "Advocate Requests", badge: 3 },
  { icon: "💬", label: "Messages", badge: 5 },
  { icon: "📅", label: "Hearings", badge: 2 },
  { icon: "📄", label: "Documents" },
  { icon: "💳", label: "Payments" },
  { icon: "🔍", label: "Legal Tools" },
];

function Ring({ pct, size = 64, stroke = 6, color = "#f59e0b" }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color}99)`, transition: "stroke-dasharray 0.8s ease" }} />
    </svg>
  );
}

function StatCard({ icon, label, value, sub, glow }: { icon: string; label: string; value: string | number; sub: string; glow: string }) {
  return (
    <div className="relative rounded-2xl p-4 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
      <div className="absolute inset-0 opacity-30 rounded-2xl" style={{ background: `radial-gradient(circle at top right, ${glow}, transparent 70%)` }} />
      <div className="relative">
        <div className="text-xl mb-1">{icon}</div>
        <div className="text-2xl font-bold text-white mb-0.5" style={{ fontFamily: "system-ui" }}>{value}</div>
        <div className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">{label}</div>
        <div className="text-[10px] text-white/30 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

export function Aurora() {
  const [activeCase, setActiveCase] = useState(0);
  const [activeNav, setActiveNav] = useState(0);
  const selected = cases[activeCase];
  const stageIdx = STAGES.indexOf(selected.stage);

  return (
    <div className="flex h-screen text-white overflow-hidden" style={{ background: "#060d1f", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute rounded-full opacity-20" style={{ width: 600, height: 600, top: -200, left: -100, background: "radial-gradient(circle, #1e3a5f, transparent 70%)" }} />
        <div className="absolute rounded-full opacity-15" style={{ width: 400, height: 400, bottom: -100, right: 200, background: "radial-gradient(circle, #92400e, transparent 70%)" }} />
        <div className="absolute rounded-full opacity-10" style={{ width: 300, height: 300, top: "40%", right: "15%", background: "radial-gradient(circle, #1d4ed8, transparent 70%)" }} />
      </div>

      {/* Sidebar */}
      <aside className="relative z-10 flex flex-col w-[220px] flex-shrink-0 py-6" style={{ background: "rgba(10,20,40,0.7)", borderRight: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
        {/* Logo */}
        <div className="px-5 mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 0 20px rgba(245,158,11,0.4)" }}>⚖</div>
            <span className="font-bold text-[15px] tracking-tight">LitigaForge <span style={{ color: "#f59e0b" }}>AI</span></span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item, i) => (
            <button key={i} onClick={() => setActiveNav(i)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 text-sm relative group"
              style={{ background: i === activeNav ? "rgba(245,158,11,0.12)" : "transparent", color: i === activeNav ? "#f59e0b" : "rgba(255,255,255,0.45)" }}>
              {i === activeNav && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: "#f59e0b", boxShadow: "0 0 8px #f59e0b" }} />}
              <span className="text-base">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
              {item.badge && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom help */}
        <div className="px-4 mt-4">
          <div className="rounded-xl p-3 text-center" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))", border: "1px solid rgba(245,158,11,0.2)" }}>
            <div className="text-lg mb-1">🤝</div>
            <div className="text-[11px] font-semibold text-white/60">NALSA Legal Aid</div>
            <div className="text-[10px] text-white/35 mt-0.5">Free help available</div>
            <button className="mt-2 text-[10px] font-semibold px-3 py-1 rounded-lg w-full" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>Check Eligibility</button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative z-10">
        {/* Top bar */}
        <div className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between" style={{ background: "rgba(6,13,31,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div>
            <h1 className="text-lg font-bold">Good day, Krishna 👋</h1>
            <p className="text-xs text-white/35">Here's your legal overview — {new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              🔔
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.8)" }} />
            </button>
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>K</div>
              <div>
                <div className="text-xs font-semibold">Krishna R.</div>
                <div className="text-[10px] text-white/35">Client — Pro</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Stat row */}
          <div className="grid grid-cols-5 gap-3">
            <StatCard icon="📁" label="Active Cases" value={3} sub="2 with hearings" glow="#3b82f680" />
            <StatCard icon="⚖️" label="Match Proposals" value={5} sub="3 pending review" glow="#f59e0b80" />
            <StatCard icon="📅" label="Next Hearing" value="25 Jun" sub="District Court" glow="#8b5cf680" />
            <StatCard icon="📄" label="Documents" value={18} sub="4 pending upload" glow="#06b6d480" />
            <div className="relative rounded-2xl p-4 flex flex-col items-center justify-center overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
              <div className="absolute inset-0 opacity-20 rounded-2xl" style={{ background: "radial-gradient(circle, #10b98180, transparent 70%)" }} />
              <div className="relative">
                <Ring pct={85} size={60} stroke={5} color="#10b981" />
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">85%</div>
              </div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Case Health</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {/* LEFT — Cases */}
            <div className="col-span-2 space-y-4">
              {/* Cases */}
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white/90">My Cases</h2>
                  <div className="flex gap-1">
                    {cases.map((_, i) => (
                      <button key={i} onClick={() => setActiveCase(i)} className="w-2 h-2 rounded-full transition-all" style={{ background: i === activeCase ? "#f59e0b" : "rgba(255,255,255,0.15)", boxShadow: i === activeCase ? "0 0 6px #f59e0b" : "none" }} />
                    ))}
                  </div>
                </div>

                {/* Case detail spotlight */}
                <div className="mx-4 mb-4 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selected.priority === "high" ? "bg-rose-500/20 text-rose-400" : selected.priority === "medium" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>{selected.priority.toUpperCase()}</span>
                        <span className="text-[10px] text-white/30">{selected.type}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-white">{selected.title}</h3>
                      <div className="text-[11px] text-white/40 mt-0.5">👨‍⚖️ {selected.lawyer} · 📅 {selected.hearing}</div>
                    </div>
                    <div className="text-right">
                      <Ring pct={selected.health} size={44} stroke={4} color={selected.health > 80 ? "#10b981" : selected.health > 60 ? "#f59e0b" : "#ef4444"} />
                      <div className="text-[10px] text-white/40 mt-0.5 text-center">{selected.health}%</div>
                    </div>
                  </div>

                  {/* Stage rail */}
                  <div className="flex items-center gap-1 mt-2">
                    {STAGES.map((s, i) => (
                      <div key={s} className="flex-1 flex flex-col items-center gap-1">
                        <div className="relative w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                          <div className="absolute inset-0 rounded-full transition-all duration-500" style={{ background: i <= stageIdx ? "#f59e0b" : "transparent", boxShadow: i === stageIdx ? "0 0 6px #f59e0b" : "none" }} />
                        </div>
                        <span className={`text-[8px] font-medium ${i === stageIdx ? "text-amber-400" : i < stageIdx ? "text-white/40" : "text-white/20"}`}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Case list */}
                <div className="px-4 pb-4 space-y-2">
                  {cases.map((c, i) => (
                    <button key={c.id} onClick={() => setActiveCase(i)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200"
                      style={{ background: i === activeCase ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${i === activeCase ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)"}` }}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.priority === "high" ? "bg-rose-500" : c.priority === "medium" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ boxShadow: `0 0 6px currentColor` }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white/80 truncate">{c.title}</div>
                        <div className="text-[10px] text-white/35">{c.stage} · {c.hearing}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-white/30">{c.health}%</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advocate Matches */}
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <h2 className="text-sm font-bold text-white/90">AI Match Proposals</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>3 pending</span>
                </div>
                <div className="p-4 grid grid-cols-3 gap-3">
                  {matches.map((m, i) => (
                    <div key={i} className="rounded-xl p-3 flex flex-col gap-2 group cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="flex items-start justify-between">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.3), rgba(245,158,11,0.1))", border: "1px solid rgba(245,158,11,0.2)" }}>
                          {m.name.split(" ")[1][0]}
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: i === 0 ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.15)", color: i === 0 ? "#10b981" : "#f59e0b" }}>{m.tag}</span>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-white/90">{m.name}</div>
                        <div className="text-[10px] text-white/40">{m.specialty} · {m.exp}y exp</div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/40">Match</span>
                          <span className="text-[11px] font-bold" style={{ color: "#f59e0b" }}>{m.score}%</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                          <div className="h-full rounded-full" style={{ width: `${m.score}%`, background: "linear-gradient(90deg, #f59e0b, #d97706)", boxShadow: "0 0 6px rgba(245,158,11,0.5)" }} />
                        </div>
                      </div>
                      <button className="text-[10px] font-bold py-1.5 rounded-lg w-full mt-1 transition-all" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#1a0f00" }}>Accept Proposal</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT panel */}
            <div className="space-y-4">
              {/* AI Insights */}
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-sm">✨</span>
                  <h3 className="text-sm font-bold text-white/90">AI Insights</h3>
                </div>
                <div className="p-3 space-y-2">
                  {insights.map((ins, i) => (
                    <div key={i} className={`p-3 rounded-xl bg-gradient-to-br ${ins.color} border border-white/5 cursor-pointer hover:border-white/10 transition-all`}>
                      <div className="flex items-start gap-2">
                        <span className="text-base leading-none">{ins.icon}</span>
                        <div>
                          <div className="text-[11px] font-semibold text-white/90">{ins.label}</div>
                          <div className="text-[10px] text-white/45 mt-0.5">{ins.detail}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming Hearings */}
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <h3 className="text-sm font-bold text-white/90">Upcoming Hearings</h3>
                </div>
                <div className="p-3 space-y-2">
                  {[{ date: "25", month: "JUN", title: "Property Dispute Hearing", court: "District Court, Khammam", time: "10:30 AM" },
                    { date: "02", month: "JUL", title: "Document Verification", court: "Virtual Meeting", time: "02:00 PM" }].map((h, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div className="flex flex-col items-center justify-center w-10 h-10 rounded-xl flex-shrink-0" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}>
                        <span className="text-[13px] font-bold leading-none" style={{ color: "#f59e0b" }}>{h.date}</span>
                        <span className="text-[8px] font-semibold" style={{ color: "#f59e0b88" }}>{h.month}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-white/85 truncate">{h.title}</div>
                        <div className="text-[10px] text-white/35 truncate">{h.court}</div>
                        <div className="text-[10px] font-semibold mt-0.5" style={{ color: "#f59e0b99" }}>{h.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-sm font-bold text-white/90 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[["📋", "Post Case"], ["📤", "Upload Doc"], ["💬", "Chat Lawyer"], ["💳", "Make Payment"]].map(([icon, label]) => (
                    <button key={label} className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-center transition-all hover:scale-[1.03]"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <span className="text-lg">{icon}</span>
                      <span className="text-[10px] font-medium text-white/50">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
