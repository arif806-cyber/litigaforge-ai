export default function Slide08Traction() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />

      <div style={{ position: "absolute", top: "7vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.6vh", lineHeight: 1.2 }}>
          The platform is fully built, deployed, and functional — not a prototype
        </div>
        <div style={{ width: "4vw", height: "2px", background: "#C8933F", marginBottom: "3.5vh" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5vh 5vw" }}>
          <div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Completed &amp; Live</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.4 }}>Full client dashboard — post case, view matches, upload documents, track hearings, contact lawyer</div>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.4 }}>Full lawyer dashboard — receive matched cases, manage documents, CNR lookups, case stage tracking</div>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.4 }}>AI matching engine — scores up to 100+ advocate profiles, returns ranked proposals with explanations</div>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.4 }}>Full AI tool suite — Legal Q&amp;A, Document Analyzer, Judgment Finder, AI Chat, 10 doc templates</div>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.4 }}>Subscription payments via Razorpay, JWT auth, WhatsApp hearing alerts via Twilio</div>
              <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.4 }}>Admin panel — advocate verification, user management, approval workflow</div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Next 90-Day Milestones</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh", marginBottom: "3vh" }}>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ fontSize: "1.85vw", color: "#C8933F", fontWeight: 700, minWidth: "1.5vw" }}>1.</div>
                <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.4 }}>Beta launch with 50 verified TG &amp; AP advocates — onboard, verify, and activate in district courts</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ fontSize: "1.85vw", color: "#C8933F", fontWeight: 700, minWidth: "1.5vw" }}>2.</div>
                <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.4 }}>First 500 active users — client case posts, AI match proposals, and accepted engagements</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ fontSize: "1.85vw", color: "#C8933F", fontWeight: 700, minWidth: "1.5vw" }}>3.</div>
                <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.4 }}>Subscription revenue — convert beta users to Professional and Advocate Pro plans</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ fontSize: "1.85vw", color: "#C8933F", fontWeight: 700, minWidth: "1.5vw" }}>4.</div>
                <div style={{ fontSize: "1.85vw", color: "#E0D8CC", lineHeight: 1.4 }}>Expo mobile app — Android and iOS release for client and lawyer users</div>
              </div>
            </div>

            <div style={{ padding: "1.8vh 2vw", background: "#1A2430", borderLeft: "3px solid #C8933F" }}>
              <div style={{ fontSize: "1.8vw", color: "#F5F0E8", fontWeight: 600, lineHeight: 1.35 }}>
                Every feature described in this deck is built, tested, and accessible at the live URL — not roadmap.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "4vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Confidential · May 2026</div>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>LitigaForge AI · 8 / 10</div>
      </div>
    </div>
  );
}
