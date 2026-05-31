export default function Slide06Technology() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />

      <div style={{ position: "absolute", top: "7vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.6vh", lineHeight: 1.2 }}>
          Production-grade stack with 16 live government API integrations and a three-AI cascade
        </div>
        <div style={{ width: "4vw", height: "2px", background: "#C8933F", marginBottom: "3.5vh" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5vh 4vw" }}>
          <div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Application Layer</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
              <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Frontend:</span> React 19 + Vite + Tailwind v4 — mobile-first, PWA-ready (Android &amp; iOS)</div>
              <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Backend:</span> Python 3.12, FastAPI, Uvicorn, LangGraph orchestration</div>
              <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Database:</span> PostgreSQL — users, cases, matches, documents, chat, subscriptions</div>
              <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Auth:</span> bcrypt + JWT (30-day tokens), role-based access (client / lawyer / admin)</div>
              <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Payments:</span> Razorpay subscription orders, webhook verification</div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>AI &amp; Government APIs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
              <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>AI Cascade:</span> Claude Sonnet 4.6 → Gemini 2.5 Flash → GPT-5 — fallback chain, never generic output</div>
              <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Live APIs:</span> eCourts (CNR, case search, orders), Mee Seva TG, Transport TS, NSE, FOREX — via API Setu sandbox</div>
              <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Ready APIs:</span> DigiLocker, MCA, GSTIN, PAN, VAHAN, SARATHI, IFSC, Pincode — data-driven mock, production-ready</div>
              <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Alerts:</span> Twilio WhatsApp hearing reminders + watch-mode case scheduler</div>
              <div style={{ fontSize: "1.8vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Mobile:</span> Expo (React Native) with NativeWind — in active development</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "3vh", padding: "1.8vh 2.5vw", background: "#1A2430", borderLeft: "3px solid #C8933F" }}>
          <div style={{ fontSize: "1.8vw", color: "#F5F0E8", fontWeight: 400, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 700 }}>Architecture decision:</span> All AI calls route through Replit's proxy — no API keys required from the user. The platform scales without per-token cost exposure until production volumes justify direct contracts.
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "4vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Confidential · May 2026</div>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>LitigaForge AI · 6 / 11</div>
      </div>
    </div>
  );
}
