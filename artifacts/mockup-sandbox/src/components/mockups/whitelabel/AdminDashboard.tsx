export function AdminDashboard() {
  const lawyers = [
    { name: "Adv. Priya Sharma", specialty: "Family Law", cases: 8, status: "Active" },
    { name: "Adv. Ravi Menon", specialty: "Criminal Law", cases: 6, status: "Active" },
    { name: "Adv. Meera Iyer", specialty: "Property Law", cases: 5, status: "Active" },
    { name: "Adv. Kiran Rao", specialty: "Corporate Law", cases: 4, status: "On Leave" },
  ];
  const activity = [
    { time: "10:32 AM", text: "Sunita Reddy uploaded 2 documents for Case #C-1047" },
    { time: "09:15 AM", text: "Adv. Priya accepted new client — Ramesh Kumar" },
    { time: "Yesterday", text: "Hearing rescheduled for Case #C-1034 → July 5, 2026" },
    { time: "Yesterday", text: "Payment received ₹5,000 from Anand Pillai" },
    { time: "June 28", text: "New client registered — Fatima Begum (Property dispute)" },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <aside className="w-56 bg-[#8B1A1A] flex flex-col flex-shrink-0">
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C9A84C] flex items-center justify-center text-white font-bold text-sm">S</div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Shah & Associates</p>
              <p className="text-white/50 text-[10px]">Admin Portal</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {[
            { icon: "▦", label: "Overview", active: true },
            { icon: "⚖", label: "Cases", active: false },
            { icon: "👥", label: "Clients", active: false },
            { icon: "👨‍💼", label: "Lawyers", active: false },
            { icon: "📄", label: "Documents", active: false },
            { icon: "💳", label: "Billing", active: false },
            { icon: "🔔", label: "Alerts", active: false },
            { icon: "⚙", label: "Settings", active: false },
          ].map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                item.active
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-5">
          <div className="bg-white/10 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#C9A84C] flex items-center justify-center text-white text-xs font-bold">R</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">Rajiv Shah</p>
              <p className="text-white/50 text-[10px]">Senior Partner</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Firm Overview</h1>
            <p className="text-xs text-gray-400 mt-0.5">Tuesday, 30 June 2026</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-[#C9A84C]/10 text-[#8B1A1A] font-medium px-3 py-1 rounded-full">
              Powered by LitigaForge ⚡
            </span>
            <button className="text-xs bg-[#8B1A1A] text-white px-4 py-1.5 rounded-lg font-medium">+ Add Client</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: "Active Clients", value: "47", change: "+3 this week", up: true },
              { label: "Cases This Month", value: "23", change: "+5 vs last month", up: true },
              { label: "Revenue Collected", value: "₹1,15,000", change: "₹42,000 pending", up: false },
              { label: "Pending Hearings", value: "8", change: "Next: July 3", up: null },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-gray-100 px-4 py-4 shadow-sm">
                <p className="text-xs text-gray-400 font-medium mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className={`text-[11px] mt-1 font-medium ${
                  stat.up === true ? "text-emerald-600" : stat.up === false ? "text-amber-600" : "text-gray-400"
                }`}>{stat.change}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-800">Your Lawyers</h2>
                <button className="text-xs text-[#8B1A1A] font-medium">View All</button>
              </div>
              <div className="divide-y divide-gray-50">
                {lawyers.map((l) => (
                  <div key={l.name} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-[#8B1A1A]/10 flex items-center justify-center text-[#8B1A1A] font-bold text-xs flex-shrink-0">
                      {l.name.split(" ")[1][0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{l.name}</p>
                      <p className="text-xs text-gray-400">{l.specialty}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">{l.cases}</p>
                      <p className="text-[10px] text-gray-400">cases</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2 ${
                      l.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>{l.status}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-gray-50">
                <button className="w-full text-xs text-center text-[#8B1A1A] font-medium py-1 hover:bg-[#8B1A1A]/5 rounded-lg transition-colors">
                  + Invite a Lawyer
                </button>
              </div>
            </div>

            <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-800">Recent Activity</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {activity.map((a, i) => (
                  <div key={i} className="px-5 py-3 flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{a.text}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 bg-gradient-to-r from-[#8B1A1A] to-[#6B1414] rounded-xl px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs font-medium">Platform Licence — Shah & Associates</p>
              <p className="text-white text-lg font-bold mt-0.5">₹20,000 / month</p>
              <p className="text-white/50 text-[11px] mt-0.5">Next billing: July 22, 2026 · Auto-renews</p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-xs mb-1">Managed by LitigaForge</p>
              <button className="text-xs bg-white/15 hover:bg-white/25 text-white px-4 py-1.5 rounded-lg font-medium transition-colors">
                Manage Billing
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
