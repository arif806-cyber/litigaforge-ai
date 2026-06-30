export function LDv2TodayFocus() {
  const now = new Date();
  const slots = [
    { time: "09:00", type: "done", label: "Client Call — Ananya Singh", sub: "30 min · Custody update", tag: "Call" },
    { time: "10:30", type: "done", label: "Court Prep — Case C-1047", sub: "Review sale deed with clerk", tag: "Prep" },
    { time: "12:00", type: "now", label: "LUNCH BREAK", sub: "", tag: "" },
    { time: "14:00", type: "next", label: "Client Meeting — Ramesh Kumar", sub: "Discuss divorce settlement terms", tag: "Meeting" },
    { time: "15:30", type: "upcoming", label: "AI Research Block", sub: "Precedents for C-1047 property fraud", tag: "Research" },
    { time: "17:00", type: "upcoming", label: "Document Review — Pradeep Nair", sub: "Contract breach supporting docs", tag: "Review" },
  ];

  return (
    <div className="flex h-screen bg-[#fafafa] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-[#8B1A1A] flex items-center justify-center text-white font-bold text-xs">S</div>
            <p className="text-gray-800 font-semibold text-sm">Shah & Associates</p>
          </div>
          <p className="text-xs text-gray-400 mt-1">Adv. Priya Sharma</p>
        </div>

        {/* Date nav */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <button className="text-gray-300 text-sm">‹</button>
            <p className="text-xs font-semibold text-gray-700">June 2026</p>
            <button className="text-gray-300 text-sm">›</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {["M","T","W","T","F","S","S"].map((d,i) => (
              <p key={i} className="text-[9px] text-gray-300 font-medium py-0.5">{d}</p>
            ))}
            {[...Array(30)].map((_,i) => {
              const day = i+1;
              const today = day === 30;
              const hasEvent = [3,8,12,18].includes(day);
              return (
                <button key={i} className={`text-[10px] py-1 rounded-md relative font-medium transition-all ${
                  today ? "bg-[#8B1A1A] text-white" : "text-gray-600 hover:bg-gray-100"
                }`}>
                  {day}
                  {hasEvent && !today && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#C9A84C]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Upcoming hearings */}
        <div className="flex-1 px-4 py-3 overflow-y-auto">
          <p className="text-[10px] text-gray-400 font-semibold tracking-wider mb-2">UPCOMING HEARINGS</p>
          {[
            { date: "Jul 3", case: "C-1047", court: "High Court", days: 3 },
            { date: "Jul 8", case: "C-1043", court: "Family Court", days: 8 },
            { date: "Jul 12", case: "C-1039", court: "Civil Court", days: 12 },
          ].map(h => (
            <div key={h.case} className="mb-2 last:mb-0 p-2 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-700">{h.date}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${h.days <= 5 ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-400"}`}>
                  {h.days}d
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">{h.case} · {h.court}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Main — today's agenda */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Today</h1>
              <p className="text-sm text-gray-400 mt-0.5">Tuesday, 30 June 2026</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium">+ Add Block</button>
              <button className="text-xs bg-[#8B1A1A] text-white px-3 py-1.5 rounded-lg font-medium">AI Brief</button>
            </div>
          </div>
          {/* Day progress */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#8B1A1A] to-[#C9A84C] rounded-full" style={{width:"45%"}} />
            </div>
            <span className="text-xs text-gray-400">45% of workday done</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="max-w-2xl space-y-2">
            {slots.map((slot, i) => (
              <div key={i} className={`flex gap-4 rounded-xl px-4 py-3.5 border transition-all ${
                slot.type === "now" ? "bg-gray-50 border-gray-100 opacity-40" :
                slot.type === "done" ? "bg-white border-gray-100 opacity-50" :
                slot.type === "next" ? "bg-white border-[#8B1A1A] shadow-sm ring-1 ring-[#8B1A1A]/10" :
                "bg-white border-gray-100"
              }`}>
                <div className="w-10 flex-shrink-0 text-right">
                  <p className={`text-xs font-semibold tabular-nums ${
                    slot.type === "next" ? "text-[#8B1A1A]" : "text-gray-400"
                  }`}>{slot.time}</p>
                </div>
                <div className="w-px bg-gray-100 flex-shrink-0 self-stretch" />
                <div className="flex-1 min-w-0">
                  {slot.type === "now" ? (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      <p className="text-xs text-gray-400 font-medium">{slot.label}</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-semibold ${slot.type === "next" ? "text-gray-900" : "text-gray-700"}`}>{slot.label}</p>
                        {slot.type === "next" && <span className="text-[10px] bg-[#8B1A1A] text-white px-1.5 py-0.5 rounded-full font-medium">UP NEXT</span>}
                        {slot.type === "done" && <span className="text-[10px] text-emerald-500">✓ Done</span>}
                      </div>
                      {slot.sub && <p className="text-xs text-gray-400">{slot.sub}</p>}
                    </>
                  )}
                </div>
                {slot.tag && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full h-fit flex-shrink-0 ${
                    slot.type === "next" ? "bg-[#8B1A1A]/10 text-[#8B1A1A]" : "bg-gray-100 text-gray-400"
                  }`}>{slot.tag}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Right: today's focus card */}
      <div className="w-64 bg-white border-l border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-3">NEXT UP IN 1H 20M</p>
          <div className="bg-[#8B1A1A] rounded-xl p-4 text-white">
            <p className="text-xs text-white/70 mb-1">14:00 · Meeting</p>
            <p className="text-sm font-bold">Ramesh Kumar</p>
            <p className="text-xs text-white/70 mt-0.5">Divorce settlement discussion</p>
            <div className="mt-3 flex gap-2">
              <button className="flex-1 text-[10px] bg-white/15 py-1.5 rounded-lg font-medium">Prepare</button>
              <button className="flex-1 text-[10px] bg-[#C9A84C] py-1.5 rounded-lg font-medium">AI Brief</button>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2">TODAY'S SUMMARY</p>
          <div className="space-y-2">
            {[["4","Tasks remaining"],["2","Clients to meet"],["1","AI brief pending"]].map(([v,l]) => (
              <div key={l} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{l}</span>
                <span className="text-sm font-bold text-gray-900">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">QUICK NOTE</p>
          <textarea className="w-full h-28 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 resize-none outline-none border border-gray-100 placeholder-gray-300 leading-relaxed" placeholder="Jot something down..." readOnly value="Check if sale deed is registered post-2018 — crucial for C-1047 title claim." />
        </div>
      </div>
    </div>
  );
}
