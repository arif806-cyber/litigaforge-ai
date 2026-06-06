export default function Slide01Cover() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />
      <div style={{ position: "absolute", top: 0, right: 0, width: "4px", height: "100vh", background: "#C8933F", opacity: 0.2 }} />

      <div style={{ position: "absolute", top: "7vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#C8933F", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "5vh" }}>
          CONFIDENTIAL — PARTNER &amp; INVESTOR PRESENTATION
        </div>

        <div style={{ fontSize: "6.5vw", fontWeight: 700, color: "#F5F0E8", lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: "2.5vh", textWrap: "balance" }}>
          LitigaForge AI
        </div>

        <div style={{ fontSize: "2.4vw", fontWeight: 400, color: "#C8933F", marginBottom: "1.5vh", letterSpacing: "-0.01em" }}>
          Legal Intelligence Built for Telangana &amp; Andhra Pradesh
        </div>

        <div style={{ width: "6vw", height: "2px", background: "#C8933F", marginBottom: "4vh", opacity: 0.6 }} />

        <div style={{ fontSize: "1.9vw", fontWeight: 400, color: "#B8B0A0", lineHeight: 1.6, maxWidth: "55vw", textWrap: "pretty" }}>
          AI-powered client-lawyer matching, multi-AI legal strategy,
          and a full suite of community legal tools — India's first
          end-to-end legal intelligence platform for South India's courts.
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "6vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: "1.3vw", color: "#7A7A7A", fontWeight: 400 }}>May 2026 &nbsp;·&nbsp; Seed Stage</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.3vw", color: "#7A7A7A" }}>LitigaForge AI &nbsp;·&nbsp; 1 / 10</div>
        </div>
      </div>
    </div>
  );
}
