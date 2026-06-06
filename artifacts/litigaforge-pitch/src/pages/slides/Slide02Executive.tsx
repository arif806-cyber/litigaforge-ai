export default function Slide02Executive() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />

      <div style={{ position: "absolute", top: "7vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.8vh", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
          Executive Summary
        </div>
        <div style={{ width: "4vw", height: "2px", background: "#C8933F", marginBottom: "5vh" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "3.2vh" }}>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "2px", minWidth: "2px", height: "100%", background: "#C8933F", alignSelf: "stretch", marginTop: "0.3vh" }} />
            <div style={{ fontSize: "2vw", fontWeight: 400, color: "#F5F0E8", lineHeight: 1.45, textWrap: "pretty" }}>
              <span style={{ fontWeight: 700 }}>90 million citizens</span> in Telangana &amp; Andhra Pradesh face legal challenges with no trusted, affordable path to verified legal representation.
            </div>
          </div>

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "2px", minWidth: "2px", height: "100%", background: "#C8933F", alignSelf: "stretch", marginTop: "0.3vh" }} />
            <div style={{ fontSize: "2vw", fontWeight: 400, color: "#F5F0E8", lineHeight: 1.45, textWrap: "pretty" }}>
              LitigaForge AI solves this with <span style={{ fontWeight: 700 }}>AI-driven lawyer matching</span> (scored 0–100), a <span style={{ fontWeight: 700 }}>multi-AI legal strategy engine</span> (Claude + Gemini + GPT-5), and a full suite of <span style={{ fontWeight: 700 }}>community legal tools</span> — Q&amp;A, Document Analyzer, Judgment Finder, Free Documents.
            </div>
          </div>

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "2px", minWidth: "2px", height: "100%", background: "#C8933F", alignSelf: "stretch", marginTop: "0.3vh" }} />
            <div style={{ fontSize: "2vw", fontWeight: 400, color: "#F5F0E8", lineHeight: 1.45, textWrap: "pretty" }}>
              The platform is <span style={{ fontWeight: 700 }}>fully built and deployed</span> — complete client and lawyer dashboards, subscription payments via Razorpay, JWT auth, and a mobile-responsive web app.
            </div>
          </div>

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "2px", minWidth: "2px", height: "100%", background: "#C8933F", alignSelf: "stretch", marginTop: "0.3vh" }} />
            <div style={{ fontSize: "2vw", fontWeight: 400, color: "#F5F0E8", lineHeight: 1.45, textWrap: "pretty" }}>
              We are raising a <span style={{ fontWeight: 700 }}>seed round</span> to onboard verified TG &amp; AP advocates, run a targeted beta launch, and expand the platform's AI legal tools.
            </div>
          </div>

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ width: "2px", minWidth: "2px", height: "100%", background: "#C8933F", alignSelf: "stretch", marginTop: "0.3vh" }} />
            <div style={{ fontSize: "2vw", fontWeight: 400, color: "#F5F0E8", lineHeight: 1.45, textWrap: "pretty" }}>
              We are open to <span style={{ fontWeight: 700 }}>three paths to partnership</span>: co-founder equity, joining the team, or investment — depending on what you bring to the mission.
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "4vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Confidential · May 2026</div>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>LitigaForge AI · 2 / 10</div>
      </div>
    </div>
  );
}
