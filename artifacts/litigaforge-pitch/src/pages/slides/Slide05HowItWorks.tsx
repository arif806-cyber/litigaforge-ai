export default function Slide05HowItWorks() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />

      <div style={{ position: "absolute", top: "7vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.6vh", lineHeight: 1.2 }}>
          Both sides of the market have a dedicated, structured workflow
        </div>
        <div style={{ width: "4vw", height: "2px", background: "#C8933F", marginBottom: "4vh" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3vh 4vw" }}>
          <div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#C8933F", marginBottom: "2vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Client Journey</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.8vh" }}>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ minWidth: "2.4vw", height: "2.4vw", background: "#C8933F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#0F1923", flexShrink: 0 }}>1</div>
                <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.45, textWrap: "pretty" }}>Post a case requirement — title, type, description, budget, anonymous option</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ minWidth: "2.4vw", height: "2.4vw", background: "#C8933F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#0F1923", flexShrink: 0 }}>2</div>
                <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.45, textWrap: "pretty" }}>AI returns top 10 matched advocates with score (0–100) and plain-English explanation</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ minWidth: "2.4vw", height: "2.4vw", background: "#C8933F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#0F1923", flexShrink: 0 }}>3</div>
                <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.45, textWrap: "pretty" }}>Accept a proposal — enter a structured case workspace: AI chat, document upload, hearing date tracking, CNR lookup</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ minWidth: "2.4vw", height: "2.4vw", background: "#C8933F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#0F1923", flexShrink: 0 }}>4</div>
                <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.45, textWrap: "pretty" }}>Call, email, or WhatsApp the advocate directly from the dashboard. Receive hearing reminders.</div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#C8933F", marginBottom: "2vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Advocate Journey</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.8vh" }}>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ minWidth: "2.4vw", height: "2.4vw", background: "#2A3540", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#C8933F", border: "1px solid #C8933F", flexShrink: 0 }}>1</div>
                <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.45, textWrap: "pretty" }}>Register with Bar Council number, practice areas, district, hourly rate — admin verifies badge</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ minWidth: "2.4vw", height: "2.4vw", background: "#2A3540", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#C8933F", border: "1px solid #C8933F", flexShrink: 0 }}>2</div>
                <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.45, textWrap: "pretty" }}>Receive match proposals for cases in your practice area — review, accept, or decline</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ minWidth: "2.4vw", height: "2.4vw", background: "#2A3540", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#C8933F", border: "1px solid #C8933F", flexShrink: 0 }}>3</div>
                <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.45, textWrap: "pretty" }}>Manage active cases: upload documents, log notes, set hearing dates, run CNR lookups, track case stage</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ minWidth: "2.4vw", height: "2.4vw", background: "#2A3540", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#C8933F", border: "1px solid #C8933F", flexShrink: 0 }}>4</div>
                <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.45, textWrap: "pretty" }}>Use AI Legal Chat, Document Analyzer, Judgment Finder, and free document templates for every case</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "4vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Confidential · May 2026</div>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>LitigaForge AI · 5 / 10</div>
      </div>
    </div>
  );
}
