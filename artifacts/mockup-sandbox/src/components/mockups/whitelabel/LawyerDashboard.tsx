export function LawyerDashboard() {
  const cases = [
    { id: "C-1047", client: "Sunita Reddy", type: "Property Dispute", hearing: "July 3, 2026", stage: "High Court", urgent: true },
    { id: "C-1043", client: "Ramesh Kumar", type: "Divorce Petition", hearing: "July 8, 2026", stage: "Family Court", urgent: false },
    { id: "C-1039", client: "Pradeep Nair", type: "Contract Breach", hearing: "July 12, 2026", stage: "Civil Court", urgent: false },
    { id: "C-1031", client: "Ananya Singh", type: "Custody Matter", hearing: "July 18, 2026", stage: "Family Court", urgent: false },
  ];
  const docs = [
    { name: "Sale_Deed_Reddy.pdf", client: "Sunita Reddy", size: "2.3 MB", date: "Today" },
    { name: "Affidavit_Kumar.docx", client: "Ramesh Kumar", size: "450 KB", date: "Yesterday" },
    { name: "Court_Order_1031.pdf", client: "Ananya Singh", size: "1.1 MB", date: "June 28" },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <aside className="w-52 bg-[#8B1A1A] flex flex-col flex-shrink-0">
        <div className="px-5 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#C9A84C] flex items-center justify-center text-white font-bold text-xs">S</div>
            <p className="text-white font-semibold text-sm">Shah & Associates</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {[
            { icon: "▦", label: "My Cases", active: true, badge: "4" },
            { icon: "📅", label: "Hearings", active: false, badge: "8" },
            { icon: "💬", label: "Client Chat", active: false, badge: "2" },
            { icon: "📄", label: "Documents", active: false, badge: "" },
            { icon: "⚖", label: "AI Research", active: false, badge: "" },
            { icon: "📝", label: "Draft Docs", active: false, badge: "" },
          ].map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                item.active ? "bg-white/15 text-white font-medium" : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] bg-[#C9A84C] text-white font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-5">
          <div className="bg-white/10 rounded-lg px-3 py-2.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#C9A84C] flex items-center justify-center text-white text-xs font-bold">P</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">Adv. Priya Sharma</p>
              <p className="text-white/50 text-[10px]">Family Law</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">My Cases</h1>
            <p className="text-xs text-gray-400 mt-0.5">4 active · Next hearing in 3 days</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm relative">
                🔔
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">2</span>
              </button>
            </div>
            <button className="text-xs bg-[#8B1A1A] text-white px-4 py-1.5 rounded-lg font-medium">AI Research</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Urgent: Hearing in 3 days</p>
              <p className="text-xs text-amber-700">Case #C-1047 · Sunita Reddy · High Court Hyderabad · July 3, 2026 at 10:30 AM</p>
            </div>
            <button className="ml-auto text-xs bg-amber-600 text-white px-3 py-1 rounded-lg font-medium flex-shrink-0">Prepare</button>
          </div>

          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-3 space-y-3">
              {cases.map((c) => (
                <div key={c.id} className={`bg-white rounded-xl border shadow-sm px-5 py-4 ${c.urgent ? "border-amber-200" : "border-gray-100"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-gray-400">{c.id}</span>
                        {c.urgent && <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full">Urgent</span>}
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{c.client}</p>
                      <p className="text-xs text-gray-500">{c.type} · {c.stage}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Next Hearing</p>
                      <p className="text-sm font-semibold text-gray-700">{c.hearing}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                    <button className="text-xs text-[#8B1A1A] font-medium hover:underline">View Case</button>
                    <span className="text-gray-200">·</span>
                    <button className="text-xs text-gray-500 hover:text-gray-700">Chat Client</button>
                    <span className="text-gray-200">·</span>
                    <button className="text-xs text-gray-500 hover:text-gray-700">AI Draft</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="col-span-2 space-y-4">
              <div className="bg-gradient-to-br from-[#8B1A1A] to-[#6B1414] rounded-xl p-4 text-white">
                <p className="text-sm font-semibold mb-1">⚖ AI Legal Research</p>
                <p className="text-white/70 text-xs mb-3">Ask the AI to research case law, find precedents, or draft arguments for your hearing.</p>
                <div className="bg-white/10 rounded-lg px-3 py-2 text-xs text-white/60 mb-2">
                  "Find precedents for property fraud in Telangana High Court..."
                </div>
                <button className="w-full text-xs bg-[#C9A84C] text-white font-semibold py-2 rounded-lg">Ask AI →</button>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">Recent Documents</h3>
                  <button className="text-xs text-[#8B1A1A]">View All</button>
                </div>
                <div className="divide-y divide-gray-50">
                  {docs.map((d) => (
                    <div key={d.name} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="text-lg">📄</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{d.name}</p>
                        <p className="text-[10px] text-gray-400">{d.client} · {d.size}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{d.date}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Cases Won", value: "34", sub: "this year" },
                  { label: "Avg Rating", value: "4.8★", sub: "23 reviews" },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                    <p className="text-[10px] text-gray-300">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
