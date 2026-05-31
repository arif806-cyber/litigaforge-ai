export default function Slide03Problem() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />

      <div style={{ position: "absolute", top: "7vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.6vh", lineHeight: 1.2, textWrap: "balance" }}>
          70M+ TG &amp; AP residents face legal issues annually, yet most never reach a qualified advocate
        </div>
        <div style={{ width: "4vw", height: "2px", background: "#C8933F", marginBottom: "4.5vh" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3vh 4vw" }}>
          <div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.2vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>For Citizens</div>
            <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.4vh", textWrap: "pretty" }}>
              Finding a trustworthy lawyer relies on word-of-mouth alone — a process that takes weeks and favors those with connections.
            </div>
            <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.4vh", textWrap: "pretty" }}>
              Legal fees are opaque. Clients receive no upfront estimate and no way to verify advocate credentials before paying a retainer.
            </div>
            <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.5, textWrap: "pretty" }}>
              Case status across eCourts, land records, and government portals lives in 16 disconnected systems.
            </div>
          </div>
          <div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.2vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>For Advocates</div>
            <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.4vh", textWrap: "pretty" }}>
              Advocates spend disproportionate time on unqualified leads, manual document drafting, and phone-based scheduling.
            </div>
            <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.4vh", textWrap: "pretty" }}>
              CNR lookups, hearing date tracking, and court order retrieval require manual portal visits for every case.
            </div>
            <div style={{ fontSize: "1.9vw", color: "#E0D8CC", lineHeight: 1.5, textWrap: "pretty" }}>
              No structured platform exists for TG &amp; AP advocates to build a verified digital presence and attract the right clients.
            </div>
          </div>
        </div>

        <div style={{ marginTop: "3.5vh", padding: "2vh 2.5vw", background: "#1A2430", borderLeft: "3px solid #C8933F" }}>
          <div style={{ fontSize: "2vw", fontWeight: 600, color: "#F5F0E8", textWrap: "balance" }}>
            Result: Delayed justice, underserved citizens, and inefficient advocates — with no technology-first alternative built for South India's courts.
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "4vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Confidential · May 2026</div>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>LitigaForge AI · 3 / 10</div>
      </div>
    </div>
  );
}
