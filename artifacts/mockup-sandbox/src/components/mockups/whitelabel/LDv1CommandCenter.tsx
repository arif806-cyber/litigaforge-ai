export function LDv1CommandCenter() {
  return (
    <div className="flex h-screen bg-[#0d0d0f] font-mono overflow-hidden text-sm">
      {/* Left rail */}
      <aside className="w-14 bg-[#111114] border-r border-white/5 flex flex-col items-center py-4 gap-3 flex-shrink-0">
        {["▦","⚖","👥","📄","💬","⚙"].map((ic, i) => (
          <button key={i} className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all ${i===0 ? "bg-[#C9A84C]/20 text-[#C9A84C]" : "text-white/30 hover:text-white/60 hover:bg-white/5"}`}>
            {ic}
          </button>
        ))}
        <div className="flex-1" />
        <div className="w-7 h-7 rounded-full bg-[#8B1A1A] flex items-center justify-center text-white text-[11px] font-bold">P</div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top status bar */}
        <div className="bg-[#111114] border-b border-white/5 px-4 py-2 flex items-center gap-6 flex-shrink-0">
          <span className="text-[#C9A84C] font-bold text-xs tracking-widest">SHAH & ASSOCIATES</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/40 text-[11px]">LIVE</span>
          </div>
          <div className="flex items-center gap-6 ml-4">
            {[["4","ACTIVE CASES"],["1","URGENT"],["8","HEARINGS"],["3","DOCS PENDING"]].map(([v,l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="text-white/90 font-bold text-sm">{v}</span>
                <span className="text-white/30 text-[10px] tracking-wider">{l}</span>
              </div>
            ))}
          </div>
          <div className="ml-auto text-white/30 text-[11px]">TUE 30 JUN 2026 · 11:04:22 IST</div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main case table */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Urgent alert bar */}
            <div className="bg-[#C9A84C]/10 border-b border-[#C9A84C]/20 px-4 py-2 flex items-center gap-3 flex-shrink-0">
              <span className="text-[#C9A84C] text-[10px] font-bold tracking-widest">▲ URGENT</span>
              <span className="text-[#C9A84C]/80 text-xs">C-1047 · SUNITA REDDY · HIGH COURT HYD · HEARING IN 72H → 03 JUL 10:30</span>
              <button className="ml-auto text-[10px] border border-[#C9A84C]/40 text-[#C9A84C] px-2 py-0.5 rounded hover:bg-[#C9A84C]/10">PREPARE →</button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    {["CASE ID","CLIENT","TYPE","COURT","NEXT HEARING","STAGE","STATUS"].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-[10px] text-white/25 tracking-widest font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["C-1047","SUNITA REDDY","PROPERTY","HIGH COURT HYD","03 JUL 10:30","TRIAL","URGENT"],
                    ["C-1043","RAMESH KUMAR","DIVORCE","FAMILY COURT","08 JUL 11:00","MEDIATION","ACTIVE"],
                    ["C-1039","PRADEEP NAIR","CONTRACT","CIVIL COURT","12 JUL 14:00","DISCOVERY","ACTIVE"],
                    ["C-1031","ANANYA SINGH","CUSTODY","FAMILY COURT","18 JUL 10:00","HEARING","ACTIVE"],
                  ].map(([id,client,type,court,hearing,stage,status], i) => (
                    <tr key={id} className={`border-b border-white/5 cursor-pointer hover:bg-white/3 transition-colors ${i===0 ? "bg-[#C9A84C]/5" : ""}`}>
                      <td className="px-4 py-3 text-[#C9A84C] text-xs">{id}</td>
                      <td className="px-4 py-3 text-white/80 text-xs font-medium">{client}</td>
                      <td className="px-4 py-3 text-white/40 text-xs">{type}</td>
                      <td className="px-4 py-3 text-white/40 text-xs">{court}</td>
                      <td className="px-4 py-3 text-white/70 text-xs">{hearing}</td>
                      <td className="px-4 py-3 text-white/40 text-xs">{stage}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider ${status==="URGENT" ? "bg-[#C9A84C]/20 text-[#C9A84C]" : "bg-emerald-500/10 text-emerald-400"}`}>{status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Command input */}
            <div className="border-t border-white/5 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
              <span className="text-[#C9A84C] text-xs">⌘</span>
              <input className="flex-1 bg-transparent text-white/60 text-xs outline-none placeholder-white/20" placeholder='Type command or ask AI: "draft vakalath for C-1047" · "find precedents for property fraud"' readOnly />
              <kbd className="text-[10px] text-white/20 border border-white/10 px-1.5 py-0.5 rounded">ENTER</kbd>
            </div>
          </div>

          {/* Right panel */}
          <div className="w-64 border-l border-white/5 flex flex-col flex-shrink-0">
            <div className="px-3 py-2.5 border-b border-white/5">
              <p className="text-[10px] text-white/30 tracking-widest mb-2">UPCOMING · 7 DAYS</p>
              {[
                ["03 JUL","C-1047","HIGH CT","10:30"],
                ["08 JUL","C-1043","FAM CT","11:00"],
                ["12 JUL","C-1039","CIVIL CT","14:00"],
              ].map(([d,c,ct,t]) => (
                <div key={c} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-[#C9A84C] text-[10px] w-12 flex-shrink-0">{d}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-[10px] truncate">{c} · {ct}</p>
                  </div>
                  <span className="text-white/30 text-[10px]">{t}</span>
                </div>
              ))}
            </div>

            <div className="px-3 py-2.5 border-b border-white/5">
              <p className="text-[10px] text-white/30 tracking-widest mb-2">DOCS WAITING</p>
              {[["Sale Deed","SUNITA","2.3MB"],["Affidavit","RAMESH","450KB"]].map(([d,c,s]) => (
                <div key={d} className="flex items-center gap-2 py-1.5">
                  <span className="text-white/20 text-xs">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/60 text-[10px] truncate">{d}</p>
                    <p className="text-white/25 text-[10px]">{c} · {s}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-1 px-3 py-2.5">
              <p className="text-[10px] text-white/30 tracking-widest mb-2">AI RESEARCH</p>
              <div className="bg-white/3 rounded border border-white/5 px-2.5 py-2 text-[10px] text-white/30 leading-relaxed">
                Ask AI to research precedents, draft documents, or analyze client submissions.
              </div>
              <button className="w-full mt-2 text-[10px] bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] py-1.5 rounded tracking-wider hover:bg-[#C9A84C]/20">ASK AI →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
