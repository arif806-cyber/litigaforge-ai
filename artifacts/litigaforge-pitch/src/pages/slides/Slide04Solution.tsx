export default function Slide04Solution() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />

      <div style={{ position: "absolute", top: "7vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.6vh", lineHeight: 1.2, textWrap: "balance" }}>
          LitigaForge AI addresses all three failure points in one integrated platform
        </div>
        <div style={{ width: "4vw", height: "2px", background: "#C8933F", marginBottom: "4vh" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2vh 2.5vw" }}>
          <div style={{ background: "#131E2A", padding: "2.2vh 1.8vw", border: "1px solid #2A3540" }}>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pillar 1 — Match &amp; Connect</div>
            <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.2vh" }}>Client posts a case requirement (with anonymous option) across 9 practice areas and a budget range.</div>
            <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.2vh" }}>AI scores verified advocates 0–100 with an explanation. Client reviews, accepts, and moves into a structured case workspace.</div>
            <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.5 }}>Advocates receive only matched, qualified leads — no cold leads, no time wasted.</div>
          </div>

          <div style={{ background: "#131E2A", padding: "2.2vh 1.8vw", border: "1px solid #2A3540" }}>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pillar 2 — The Forge</div>
            <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.2vh" }}>Case facts are parsed for entities — parties, dates, locations, case types — and routed through 16 government API chains in sequence.</div>
            <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.2vh" }}>Claude Sonnet, Gemini 2.5 Flash, and GPT-5 synthesize a multi-source legal strategy — with fallback cascade so output is never generic.</div>
            <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.5 }}>Results are stored in case memory and surfaced in the Case Detail dashboard.</div>
          </div>

          <div style={{ background: "#131E2A", padding: "2.2vh 1.8vw", border: "1px solid #2A3540" }}>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pillar 3 — Community Tools</div>
            <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.2vh" }}>Legal Q&amp;A: any citizen asks a question, Claude answers instantly. Past answers form a community knowledge base.</div>
            <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.2vh" }}>Document Analyzer: paste contract or FIR text, receive a risk score, missing-clause audit, and recommendations.</div>
            <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.5 }}>Judgment Finder, Free Legal Aid Wizard (NALSA / TSLSA), Lawyer Directory, and 10 AI-generated document templates.</div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "4vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Confidential · May 2026</div>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>LitigaForge AI · 4 / 10</div>
      </div>
    </div>
  );
}
