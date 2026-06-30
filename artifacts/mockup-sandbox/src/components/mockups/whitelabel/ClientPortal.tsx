export function ClientPortal() {
  const stages = [
    { label: "Case Filed", date: "May 15, 2026", done: true },
    { label: "Documents Submitted", date: "May 22, 2026", done: true },
    { label: "First Hearing", date: "June 10, 2026", done: true },
    { label: "Next Hearing", date: "July 3, 2026", done: false, active: true },
    { label: "Judgment", date: "Awaited", done: false },
  ];
  const messages = [
    { time: "10:15 AM", text: "Please upload the original sale deed before July 1st. The court will require it.", mine: false },
    { time: "10:42 AM", text: "I have uploaded it just now. Please check the Documents section.", mine: true },
    { time: "11:02 AM", text: "Received, thank you! We are well-prepared for the July 3 hearing.", mine: false },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#8B1A1A] flex items-center justify-center text-white font-bold text-xs">S</div>
            <p className="text-gray-800 font-semibold text-sm">Shah & Associates</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <p className="text-[10px] text-emerald-600 font-semibold">Your Lawyer</p>
            <p className="text-xs font-semibold text-gray-800 mt-0.5">Adv. Priya Sharma</p>
            <p className="text-[10px] text-gray-400">Family Law Specialist</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              <span className="text-[10px] text-emerald-600">Online now</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {[
            { icon: "📋", label: "My Case", active: true, badge: "" },
            { icon: "💬", label: "Chat", active: false, badge: "1" },
            { icon: "📄", label: "Documents", active: false, badge: "" },
            { icon: "📅", label: "Hearings", active: false, badge: "" },
            { icon: "💳", label: "Payments", active: false, badge: "" },
            { icon: "🆘", label: "Legal Aid", active: false, badge: "" },
          ].map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                item.active
                  ? "bg-[#8B1A1A]/8 text-[#8B1A1A] font-semibold"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] bg-[#8B1A1A] text-white font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-5">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-[#8B1A1A]/15 flex items-center justify-center text-[#8B1A1A] font-bold text-[11px]">S</div>
            <div>
              <p className="text-xs font-medium text-gray-700">Sunita Reddy</p>
              <p className="text-[10px] text-gray-400">Client</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Property Dispute — Case #C-1047</h1>
            <p className="text-xs text-gray-400 mt-0.5">High Court Hyderabad · Filed May 15, 2026</p>
          </div>
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-3 py-1 rounded-full">
            ⏰ Hearing in 3 days
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-5 bg-[#8B1A1A] rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl flex-shrink-0">📅</div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Next Hearing: July 3, 2026 at 10:30 AM</p>
              <p className="text-white/70 text-xs mt-0.5">High Court Hyderabad, Court Room 4 · Be present 30 minutes early</p>
            </div>
            <button className="flex-shrink-0 text-xs bg-[#C9A84C] text-white font-semibold px-4 py-2 rounded-lg">Add to Calendar</button>
          </div>

          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-3 space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-800 mb-4">Case Progress</h2>
                <div className="space-y-0">
                  {stages.map((s, i) => (
                    <div key={s.label} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                          s.done ? "bg-emerald-500 text-white" : s.active ? "bg-[#8B1A1A] text-white ring-2 ring-[#8B1A1A]/20" : "bg-gray-100 text-gray-400"
                        }`}>
                          {s.done ? "✓" : i + 1}
                        </div>
                        {i < stages.length - 1 && (
                          <div className={`w-0.5 h-8 mt-1 ${s.done ? "bg-emerald-300" : "bg-gray-100"}`} />
                        )}
                      </div>
                      <div className={`pb-4 ${i === stages.length - 1 ? "pb-0" : ""}`}>
                        <p className={`text-sm font-medium ${s.active ? "text-[#8B1A1A]" : s.done ? "text-gray-700" : "text-gray-400"}`}>{s.label}</p>
                        <p className={`text-xs mt-0.5 ${s.done ? "text-emerald-600" : s.active ? "text-[#8B1A1A]/70" : "text-gray-300"}`}>{s.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                  <h2 className="text-sm font-semibold text-gray-800">My Documents</h2>
                  <button className="text-xs bg-[#8B1A1A] text-white px-3 py-1 rounded-lg font-medium">+ Upload</button>
                </div>
                <div className="divide-y divide-gray-50">
                  {[
                    { name: "Sale_Deed_Original.pdf", size: "2.3 MB", date: "Today", status: "Received by lawyer" },
                    { name: "Property_Tax_Receipt.pdf", size: "840 KB", date: "June 20", status: "Verified" },
                    { name: "Encumbrance_Certificate.pdf", size: "1.2 MB", date: "June 18", status: "Verified" },
                  ].map((d) => (
                    <div key={d.name} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-sm flex-shrink-0">📄</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{d.name}</p>
                        <p className="text-[10px] text-gray-400">{d.size} · {d.date}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        d.status === "Verified" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                      }`}>{d.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
              <div className="px-4 py-3.5 border-b border-gray-50 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#8B1A1A]/10 flex items-center justify-center text-[#8B1A1A] font-bold text-xs">P</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Adv. Priya Sharma</p>
                  <p className="text-[10px] text-emerald-600 font-medium">● Online</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      m.mine
                        ? "bg-[#8B1A1A] text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-700 rounded-bl-sm"
                    }`}>
                      <p>{m.text}</p>
                      <p className={`text-[10px] mt-1 ${m.mine ? "text-white/60" : "text-gray-400"}`}>{m.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 pb-3 pt-2 border-t border-gray-50">
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <input
                    className="flex-1 bg-transparent text-xs text-gray-600 placeholder-gray-400 outline-none"
                    placeholder="Type a message..."
                    readOnly
                  />
                  <button className="w-6 h-6 rounded-lg bg-[#8B1A1A] flex items-center justify-center text-white text-[11px] flex-shrink-0">→</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
