import { useState } from "react";

const cases = [
  { id: 1, title: "Property Distribution — Khammam", type: "Property", stage: 3, stageLabel: "Arguments", health: 82, hearing: "Jun 25", lawyer: "Adv. Ramesh", priority: "high", color: "#ef4444" },
  { id: 2, title: "Land Registration Issue", type: "Revenue", stage: 2, stageLabel: "Evidence", health: 67, hearing: "Jul 2", lawyer: "Adv. Priya", priority: "medium", color: "#f59e0b" },
  { id: 3, title: "Sale Agreement Dispute", type: "Civil", stage: 0, stageLabel: "Filed", health: 91, hearing: "Jul 18", lawyer: "Unassigned", priority: "low", color: "#10b981" },
];

const STAGES = ["Filed", "Admitted", "Evidence", "Arguments", "Reserved", "Judgment"];

const matches = [
  { name: "Adv. Ramesh K.", score: 96, specialty: "Property Law", exp: "15y", badge: "Top Match", badgeColor: "#10b981" },
  { name: "Adv. Suresh M.", score: 92, specialty: "Civil Expert", exp: "12y", badge: "Great Match", badgeColor: "#3b82f6" },
  { name: "Adv. Priya N.", score: 89, specialty: "Litigation", exp: "10y", badge: "Good Match", badgeColor: "#8b5cf6" },
];

const stats = [
  { value: "3", label: "Active Cases", icon: "📁", accent: "#3b82f6", bg: "#eff6ff" },
  { value: "5", label: "New Proposals", icon: "⚖️", accent: "#f59e0b", bg: "#fffbeb" },
  { value: "2", label: "Hearings Soon", icon: "📅", accent: "#8b5cf6", bg: "#f5f3ff" },
  { value: "18", label: "Documents", icon: "📄", accent: "#10b981", bg: "#ecfdf5" },
  { value: "85%", label: "Case Health", icon: "❤️", accent: "#ef4444", bg: "#fef2f2" },
];

export function Pulse() {
  const [activeCase, setActiveCase] = useState(0);
  const [activeNav, setActiveNav] = useState(0);

  const navItems = [
    { icon: "▣", label: "Dashboard" },
    { icon: "📁", label: "My Cases" },
    { icon: "⚖️", label: "Advocate Requests", badge: 3 },
    { icon: "💬", label: "Messages", badge: 5 },
    { icon: "📅", label: "Hearings", badge: 2 },
    { icon: "📄", label: "Documents" },
    { icon: "💳", label: "Payments" },
    { icon: "🔍", label: "Legal Tools" },
  ];

  const sel = cases[activeCase];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-white flex flex-col py-5 shadow-sm" style={{ borderRight: "1px solid #f1f5f9" }}>
        {/* Logo */}
        <div className="px-5 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #1a2744, #2d4a8a)" }}>⚖</div>
            <div>
              <span className="font-black text-[14px] text-gray-900">LitigaForge</span>
              <span className="font-black text-[14px]" style={{ color: "#f59e0b" }}> AI</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item, i) => (
            <button key={i} onClick={() => setActiveNav(i)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 text-sm group"
              style={{ background: i === activeNav ? "#f0f4ff" : "transparent", color: i === activeNav ? "#1a2744" : "#94a3b8", fontWeight: i === activeNav ? 600 : 400 }}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "#1a2744" }}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 mt-4 pt-4" style={{ borderTop: "1px solid #f1f5f9" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>KR</div>
            <div>
              <div className="text-xs font-bold text-gray-800">Krishna R.</div>
              <div className="text-[10px] text-gray-400">Professional Plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white px-6 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid #f1f5f9" }}>
          <div>
            <h1 className="text-lg font-black text-gray-900">Good day, Krishna 👋</h1>
            <p className="text-xs text-gray-400">{new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-sm border border-gray-100">
              🔔
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            </button>
            <button className="px-3 py-1.5 text-xs font-bold rounded-xl text-white" style={{ background: "linear-gradient(135deg, #1a2744, #2d4a8a)" }}>+ Post Case</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Stat strip */}
          <div className="grid grid-cols-5 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow cursor-default" style={{ border: "1px solid #f1f5f9" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: s.bg }}>
                  {s.icon}
                </div>
                <div>
                  <div className="text-2xl font-black text-gray-900">{s.value}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: s.accent }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-5">
            {/* LEFT — Cases + Matches */}
            <div className="col-span-2 space-y-4">
              {/* Case cards */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
                <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid #f8fafc" }}>
                  <h2 className="text-sm font-black text-gray-900">My Cases</h2>
                  <button className="text-[11px] font-semibold text-blue-600">View All →</button>
                </div>

                {/* Selected case spotlight */}
                <div className="p-4 pb-3" style={{ borderBottom: "1px solid #f8fafc" }}>
                  <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${sel.color}08, ${sel.color}15)`, border: `1px solid ${sel.color}30` }}>
                    {/* Decorative arc */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10">
                      <svg width="80" height="80" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="35" fill="none" stroke={sel.color} strokeWidth="2" strokeDasharray="4 6" />
                      </svg>
                    </div>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: sel.color }}>{sel.priority.toUpperCase()}</span>
                          <span className="text-[10px] text-gray-400 font-medium">{sel.type} Law</span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900">{sel.title}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">👨‍⚖️ {sel.lawyer} &nbsp;·&nbsp; 📅 {sel.hearing}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-black" style={{ color: sel.color }}>{sel.health}%</div>
                        <div className="text-[10px] text-gray-400">Health Score</div>
                      </div>
                    </div>

                    {/* Stage pipeline */}
                    <div className="flex items-center gap-1">
                      {STAGES.map((s, i) => (
                        <div key={s} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/60">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: i <= sel.stage ? "100%" : "0%", background: i < sel.stage ? sel.color : i === sel.stage ? `linear-gradient(90deg, ${sel.color}, ${sel.color}cc)` : "transparent", opacity: i < sel.stage ? 0.5 : 1 }} />
                          </div>
                          <span className="text-[8px] font-semibold" style={{ color: i === sel.stage ? sel.color : "#94a3b8" }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Case list */}
                <div className="p-3 space-y-1.5">
                  {cases.map((c, i) => (
                    <button key={c.id} onClick={() => setActiveCase(i)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-all"
                      style={{ background: i === activeCase ? `${c.color}08` : "transparent", border: `1px solid ${i === activeCase ? c.color + "25" : "transparent"}` }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-800 truncate">{c.title}</div>
                        <div className="text-[10px] text-gray-400">{c.stageLabel} · {c.hearing}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1 rounded-full overflow-hidden bg-gray-100">
                          <div className="h-full rounded-full" style={{ width: `${c.health}%`, background: c.color }} />
                        </div>
                        <span className="text-[10px] font-bold w-8 text-right" style={{ color: c.color }}>{c.health}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Match proposals */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #f8fafc" }}>
                  <h2 className="text-sm font-black text-gray-900">AI Match Proposals</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">3 pending</span>
                </div>
                <div className="p-4 grid grid-cols-3 gap-3">
                  {matches.map((m, i) => (
                    <div key={i} className="rounded-xl border p-3 flex flex-col gap-2.5 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5" style={{ borderColor: "#f1f5f9" }}>
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white" style={{ background: `linear-gradient(135deg, ${m.badgeColor}, ${m.badgeColor}cc)` }}>
                          {m.name.split(" ")[1][0]}
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: m.badgeColor + "15", color: m.badgeColor }}>{m.badge}</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">{m.name}</div>
                        <div className="text-[10px] text-gray-400">{m.specialty} · {m.exp} exp</div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-gray-400">Match score</span>
                          <span className="text-xs font-black" style={{ color: m.badgeColor }}>{m.score}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${m.score}%`, background: `linear-gradient(90deg, ${m.badgeColor}, ${m.badgeColor}99)` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button className="text-[10px] font-semibold py-1.5 rounded-lg border text-gray-600 hover:bg-gray-50">Profile</button>
                        <button className="text-[10px] font-bold py-1.5 rounded-lg text-white" style={{ background: m.badgeColor }}>Accept</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="space-y-4">
              {/* Priority Centre */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #f8fafc" }}>
                  <span className="text-sm">🎯</span>
                  <h3 className="text-sm font-black text-gray-900">Priority Centre</h3>
                </div>
                <div className="p-3 space-y-2">
                  {[
                    { label: "High Priority", sub: "2 matters need action", color: "#ef4444", bg: "#fef2f2" },
                    { label: "Medium Priority", sub: "1 matter needs attention", color: "#f59e0b", bg: "#fffbeb" },
                    { label: "Low Priority", sub: "0 matters pending", color: "#10b981", bg: "#ecfdf5" },
                  ].map((p) => (
                    <div key={p.label} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:opacity-80 transition-all" style={{ background: p.bg }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <div className="flex-1">
                        <div className="text-[11px] font-bold" style={{ color: p.color }}>{p.label}</div>
                        <div className="text-[10px] text-gray-500">{p.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming Hearings */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #f8fafc" }}>
                  <h3 className="text-sm font-black text-gray-900">Upcoming Hearings</h3>
                  <button className="text-[11px] font-semibold text-blue-600">Calendar →</button>
                </div>
                <div className="p-3 space-y-2">
                  {[{ date: "25", month: "JUN", title: "Property Dispute Hearing", court: "District Court, Khammam", time: "10:30 AM", color: "#ef4444" },
                    { date: "02", month: "JUL", title: "Document Verification", court: "Virtual Meeting", time: "02:00 PM", color: "#3b82f6" }].map((h) => (
                    <div key={h.date} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all cursor-pointer border border-gray-50">
                      <div className="flex flex-col items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 text-white" style={{ background: h.color }}>
                        <span className="text-[13px] font-black leading-none">{h.date}</span>
                        <span className="text-[8px] font-semibold opacity-80">{h.month}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-gray-900 truncate">{h.title}</div>
                        <div className="text-[10px] text-gray-400 truncate">{h.court}</div>
                        <div className="text-[10px] font-bold mt-0.5" style={{ color: h.color }}>{h.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #f1f5f9" }}>
                <h3 className="text-sm font-black text-gray-900 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: "📋", label: "Post Case", color: "#3b82f6" },
                    { icon: "📤", label: "Upload Docs", color: "#10b981" },
                    { icon: "💬", label: "Chat Lawyer", color: "#8b5cf6" },
                    { icon: "💳", label: "Make Payment", color: "#f59e0b" },
                  ].map((a) => (
                    <button key={a.label} className="flex items-center gap-2 p-2.5 rounded-xl border hover:border-transparent hover:shadow-sm transition-all group" style={{ borderColor: "#f1f5f9" }}>
                      <span className="text-base">{a.icon}</span>
                      <span className="text-[10px] font-semibold text-gray-600">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Notifications */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid #f8fafc" }}>
                  <h3 className="text-sm font-black text-gray-900">Recent Activity</h3>
                </div>
                <div className="p-3 space-y-1">
                  {[
                    { icon: "⚖️", text: "New advocate proposal received", time: "10 min ago", color: "#3b82f6" },
                    { icon: "💬", text: "Adv. Ramesh replied", time: "1 hr ago", color: "#10b981" },
                    { icon: "📅", text: "Hearing date updated", time: "3 hrs ago", color: "#f59e0b" },
                  ].map((n, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0" style={{ background: n.color + "15" }}>{n.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-gray-700 truncate">{n.text}</div>
                        <div className="text-[9px] text-gray-400">{n.time}</div>
                      </div>
                    </div>
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
