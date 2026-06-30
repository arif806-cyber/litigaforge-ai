import { useState } from "react";

export function LDv4AICopilot() {
  const suggestions = [
    "Prepare hearing brief for C-1047",
    "Summarize Sunita's property dispute",
    "Find precedents — property fraud Telangana",
    "Draft vakalath for Ramesh Kumar",
    "What documents are missing for C-1039?",
  ];

  const messages = [
    {
      role: "user",
      text: "Summarize case C-1047 and tell me what I need for the July 3 hearing",
    },
    {
      role: "ai",
      text: "**Case C-1047 — Sunita Reddy vs. Disputed Property**\n\nThis is a property title dispute at the High Court of Hyderabad. Sunita claims ownership via a 2019 sale deed which the opposing party contests on grounds of prior encumbrance.\n\n**For July 3 hearing you need:**\n• ✅ Original sale deed (uploaded today)\n• ✅ Encumbrance certificate (on file)\n• ⚠️ Revenue records from 2017–2019 (not yet uploaded)\n• ⚠️ Witness statement from property surveyor\n\n**Recommended action:** Request Sunita to obtain the revenue records from the sub-registrar office before July 1. I can draft the request letter now.",
      actions: ["Draft letter", "Find precedents", "Set reminder"]
    },
    {
      role: "user",
      text: "Yes draft the request letter"
    },
    {
      role: "ai",
      text: "**Draft: Request for Revenue Records**\n\nTo, The Sub-Registrar, Hyderabad District.\n\nSub: Request for certified copy of revenue records for Survey No. [X], [Area], Hyderabad for the period 2017–2019.\n\nI, Sunita Reddy, hereby request certified copies of the above records required for ongoing litigation before the Hon'ble High Court of Hyderabad (Case No. [X]/2026)...\n\n*[Full draft ready — click to copy or send to client]*",
      actions: ["Copy letter", "Send to Sunita", "Save to case"]
    }
  ];

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      {/* Left: stats sidebar */}
      <aside className="w-56 bg-[#8B1A1A] flex flex-col flex-shrink-0">
        <div className="px-4 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-6 h-6 rounded-lg bg-[#C9A84C] flex items-center justify-center text-white font-bold text-[10px]">S</div>
            <p className="text-white font-semibold text-xs">Shah & Associates</p>
          </div>
          <p className="text-white/50 text-[10px] mt-0.5 pl-8">Adv. Priya Sharma</p>
        </div>

        {/* Quick stats */}
        <div className="px-4 py-4 border-b border-white/10">
          <p className="text-[9px] text-white/30 tracking-widest mb-3">QUICK STATS</p>
          {[
            ["4", "Active Cases"],
            ["1", "Urgent (72h)"],
            ["8", "Hearings this month"],
            ["2", "Unread messages"],
          ].map(([v,l]) => (
            <div key={l} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-white/50">{l}</span>
              <span className="text-sm font-bold text-white">{v}</span>
            </div>
          ))}
        </div>

        {/* Cases as context */}
        <div className="px-4 py-4 flex-1 overflow-y-auto">
          <p className="text-[9px] text-white/30 tracking-widest mb-3">YOUR CASES</p>
          {[
            { id:"C-1047", name:"Sunita Reddy", urgent: true },
            { id:"C-1043", name:"Ramesh Kumar", urgent: false },
            { id:"C-1039", name:"Pradeep Nair", urgent: false },
            { id:"C-1031", name:"Ananya Singh", urgent: false },
          ].map(c => (
            <button key={c.id} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/8 transition-colors group">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.urgent ? "bg-[#C9A84C]" : "bg-white/20"}`} />
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs text-white/70 font-medium truncate group-hover:text-white">{c.name}</p>
                <p className="text-[10px] text-white/30">{c.id}</p>
              </div>
              {c.urgent && <span className="text-[9px] text-[#C9A84C] font-bold">!</span>}
            </button>
          ))}
        </div>

        <div className="px-3 pb-4">
          <button className="w-full text-[11px] border border-white/15 text-white/60 py-2 rounded-lg hover:bg-white/8 transition-colors">
            + New Case
          </button>
        </div>
      </aside>

      {/* Main: AI chat */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {/* Chat header */}
        <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8B1A1A] to-[#C9A84C] flex items-center justify-center text-white text-sm">⚖</div>
            <div>
              <p className="text-sm font-semibold text-gray-900">LitigaForge AI Copilot</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <p className="text-[10px] text-emerald-600">Ready · Claude Sonnet + Gemini Flash</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg">History</button>
            <button className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg">New Chat</button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "ai" && (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#8B1A1A] to-[#C9A84C] flex items-center justify-center text-white text-xs mr-3 flex-shrink-0 mt-0.5">⚖</div>
              )}
              <div className={`max-w-lg ${m.role === "user" ? "" : "flex-1"}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#8B1A1A] text-white rounded-br-sm"
                    : "bg-white border border-gray-100 text-gray-700 rounded-bl-sm shadow-sm"
                }`}>
                  {m.text.split('\n').map((line, j) => (
                    <p key={j} className={j > 0 ? "mt-1.5" : ""}>
                      {line.startsWith('**') && line.endsWith('**')
                        ? <strong className={m.role === "ai" ? "text-gray-900" : "text-white"}>{line.slice(2,-2)}</strong>
                        : line}
                    </p>
                  ))}
                </div>
                {m.actions && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {m.actions.map(a => (
                      <button key={a} className="text-xs bg-white border border-[#8B1A1A]/20 text-[#8B1A1A] px-3 py-1 rounded-full font-medium hover:bg-[#8B1A1A]/5 transition-colors">
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Suggested prompts */}
        <div className="px-6 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
          {suggestions.map(s => (
            <button key={s} className="flex-shrink-0 text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-[#8B1A1A]/30 hover:text-[#8B1A1A] transition-colors">
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-6 pb-5 pt-2 flex-shrink-0">
          <div className="flex items-end gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-[#8B1A1A]/40 transition-colors">
            <textarea
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none resize-none leading-relaxed max-h-32"
              placeholder="Ask anything — research, drafting, case strategy, deadlines..."
              rows={1}
              readOnly
            />
            <button className="w-8 h-8 rounded-xl bg-[#8B1A1A] flex items-center justify-center text-white text-sm flex-shrink-0">→</button>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-2">Powered by Claude Sonnet 4-6 · AI responses are for assistance only — verify before filing</p>
        </div>
      </main>
    </div>
  );
}
