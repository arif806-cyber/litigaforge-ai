export default function Slide10WhyNow() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />

      <div style={{ position: "absolute", top: "7vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.6vh", lineHeight: 1.2, textWrap: "balance" }}>
          Three structural forces converge now — and LitigaForge is the only platform positioned at their intersection
        </div>
        <div style={{ width: "4vw", height: "2px", background: "#C8933F", marginBottom: "4vh" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3vh 5vw" }}>
          <div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Why Now</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2vh" }}>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.5, textWrap: "pretty" }}>
                <span style={{ fontWeight: 700, color: "#F5F0E8" }}>India's Digital Justice push is accelerating.</span> eCourts Phase 3, NALSA digitization, and the National Legal Services Authority's push for technology-enabled legal aid create direct infrastructure for LitigaForge's API chain to plug into.
              </div>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.5, textWrap: "pretty" }}>
                <span style={{ fontWeight: 700, color: "#F5F0E8" }}>LLMs now handle complex legal reasoning.</span> Claude, Gemini, and GPT-5 have crossed the threshold required for substantive legal strategy synthesis — not just keyword search. The capability window is open.
              </div>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.5, textWrap: "pretty" }}>
                <span style={{ fontWeight: 700, color: "#F5F0E8" }}>90M South India citizens have smartphones but no trusted legal access layer.</span> Mobile penetration is high; legal technology penetration is near zero.
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Our Edge</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2vh" }}>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.5, textWrap: "pretty" }}>
                <span style={{ fontWeight: 700, color: "#F5F0E8" }}>Only platform combining all three layers:</span> government API chains + AI client-lawyer matching + community legal tools. No competitor operates all three.
              </div>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.5, textWrap: "pretty" }}>
                <span style={{ fontWeight: 700, color: "#F5F0E8" }}>Built for TG &amp; AP courts, languages, and legal workflows.</span> Not a generic national clone adapted for South India — purpose-built from day one for Hyderabad and Vijayawada district courts.
              </div>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.5, textWrap: "pretty" }}>
                <span style={{ fontWeight: 700, color: "#F5F0E8" }}>Full working product in production.</span> Not a deck. Not a mockup. Not a landing page collecting email addresses. A running application with real features.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "4vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Confidential · May 2026</div>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>LitigaForge AI · 10 / 11</div>
      </div>
    </div>
  );
}
