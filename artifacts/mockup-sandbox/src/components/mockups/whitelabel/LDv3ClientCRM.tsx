export function LDv3ClientCRM() {
  const clients = [
    {
      name: "Sunita Reddy", initials: "SR", type: "Property Dispute", case: "C-1047",
      stage: "Trial", hearing: "Jul 3", urgency: "high",
      lastMsg: "Uploaded sale deed ✓", lastMsgTime: "2h ago",
      progress: 60, docs: 3, unread: 0, win: 70
    },
    {
      name: "Ramesh Kumar", initials: "RK", type: "Divorce Petition", case: "C-1043",
      stage: "Mediation", hearing: "Jul 8", urgency: "medium",
      lastMsg: "Awaiting settlement terms", lastMsgTime: "5h ago",
      progress: 40, docs: 1, unread: 2, win: 55
    },
    {
      name: "Pradeep Nair", initials: "PN", type: "Contract Breach", case: "C-1039",
      stage: "Discovery", hearing: "Jul 12", urgency: "low",
      lastMsg: "Submitted witness list", lastMsgTime: "Yesterday",
      progress: 30, docs: 4, unread: 0, win: 65
    },
    {
      name: "Ananya Singh", initials: "AS", type: "Custody Matter", case: "C-1031",
      stage: "Hearing", hearing: "Jul 18", urgency: "low",
      lastMsg: "Called re: visit schedule", lastMsgTime: "2d ago",
      progress: 25, docs: 2, unread: 1, win: 80
    },
  ];

  return (
    <div className="flex h-screen bg-[#f5f5f7] font-sans overflow-hidden">
      {/* Compact sidebar */}
      <aside className="w-14 bg-[#8B1A1A] flex flex-col items-center py-4 gap-3 flex-shrink-0">
        {["▦","📅","💬","📄","⚖","⚙"].map((ic, i) => (
          <button key={i} className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${i===0 ? "bg-white/15 text-white" : "text-white/40 hover:text-white hover:bg-white/10"}`}>
            {ic}
          </button>
        ))}
        <div className="flex-1" />
        <div className="w-8 h-8 rounded-full bg-[#C9A84C] flex items-center justify-center text-white text-xs font-bold">P</div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur border-b border-black/5 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-base font-bold text-gray-900">My Clients</h1>
            <p className="text-xs text-gray-400 mt-0.5">4 active relationships · 1 needs attention</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5">
              <span className="text-gray-400 text-xs">🔍</span>
              <input className="bg-transparent text-xs text-gray-600 outline-none placeholder-gray-400 w-28" placeholder="Search clients..." readOnly />
            </div>
            <button className="text-xs bg-[#8B1A1A] text-white px-3 py-1.5 rounded-lg font-medium">+ New Client</button>
          </div>
        </header>

        {/* Pipeline columns */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-5">
          <div className="flex gap-4 h-full min-w-max">
            {[
              { col: "🔴 High Priority", items: clients.filter(c => c.urgency === "high") },
              { col: "🟡 Active", items: clients.filter(c => c.urgency === "medium") },
              { col: "🟢 Progressing", items: clients.filter(c => c.urgency === "low") },
              { col: "✅ Resolved", items: [] },
            ].map(({ col, items }) => (
              <div key={col} className="w-72 flex flex-col flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-600">{col}</p>
                  <span className="text-[10px] bg-gray-200 text-gray-500 font-medium px-1.5 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {items.map(c => (
                    <div key={c.case} className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                      {/* Client header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#8B1A1A]/10 flex items-center justify-center text-[#8B1A1A] font-bold text-sm flex-shrink-0">
                          {c.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                            {c.unread > 0 && (
                              <span className="w-4 h-4 rounded-full bg-[#8B1A1A] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{c.unread}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{c.type}</p>
                        </div>
                      </div>

                      {/* Case info */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <p className="text-[10px] text-gray-400">Case</p>
                          <p className="text-xs font-semibold text-gray-700">{c.case}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <p className="text-[10px] text-gray-400">Next Hearing</p>
                          <p className="text-xs font-semibold text-gray-700">{c.hearing}</p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-gray-400">{c.stage}</p>
                          <p className="text-[10px] text-gray-400">{c.progress}%</p>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#8B1A1A] to-[#C9A84C]"
                            style={{ width: `${c.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Last message */}
                      <div className="flex items-start gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
                        <span className="text-xs">💬</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-600 truncate">{c.lastMsg}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">{c.lastMsgTime}</p>
                        </div>
                      </div>

                      {/* Win rate + actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-emerald-600 font-semibold">{c.win}%</span>
                          <span className="text-[10px] text-gray-400">win probability</span>
                        </div>
                        <div className="flex gap-1">
                          <button className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium hover:bg-gray-200">Chat</button>
                          <button className="text-[10px] bg-[#8B1A1A] text-white px-2 py-1 rounded-md font-medium">Open</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center">
                      <p className="text-xs text-gray-300">No cases here</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
