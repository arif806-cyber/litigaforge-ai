export default function Slide11JoinUs() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />
      <div style={{ position: "absolute", bottom: 0, left: "7vw", right: "7vw", height: "2px", background: "#C8933F", opacity: 0.3 }} />

      <div style={{ position: "absolute", top: "7vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.6vh", lineHeight: 1.2 }}>
          Three ways to be part of LitigaForge AI
        </div>
        <div style={{ width: "4vw", height: "2px", background: "#C8933F", marginBottom: "4vh" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2.5vh 2.5vw", marginBottom: "4vh" }}>
          <div style={{ background: "#131E2A", border: "1px solid #2A3540", padding: "2.5vh 2vw" }}>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Co-Founder / Strategic Partner</div>
            <div style={{ fontSize: "1.75vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.2vh" }}>Equity partnership. Own a meaningful stake in the mission and shape the company's direction from the ground up.</div>
            <div style={{ fontSize: "1.7vw", color: "#B8B0A0", lineHeight: 1.5 }}>
              Ideal fit: legal domain expert, BD/GTM leader, operations-heavy builder, or district-court network holder.
            </div>
          </div>

          <div style={{ background: "#131E2A", border: "1px solid #2A3540", padding: "2.5vh 2vw" }}>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Join the Team</div>
            <div style={{ fontSize: "1.75vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.2vh" }}>Work on India's most technically ambitious legal AI product, building at the intersection of government APIs, LLMs, and access to justice.</div>
            <div style={{ fontSize: "1.7vw", color: "#B8B0A0", lineHeight: 1.5 }}>
              Open roles: full-stack engineer, AI/ML engineer, legal content specialist, sales and partnerships.
            </div>
          </div>

          <div style={{ background: "#131E2A", border: "1px solid #2A3540", padding: "2.5vh 2vw" }}>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.5vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Invest</div>
            <div style={{ fontSize: "1.75vw", color: "#E0D8CC", lineHeight: 1.5, marginBottom: "1.2vh" }}>Seed round open. Back the infrastructure for justice in South India — a market with 90M citizens, 8M annual court filings, and no incumbent platform.</div>
            <div style={{ fontSize: "1.7vw", color: "#B8B0A0", lineHeight: 1.5 }}>
              Use of funds: API production credentials, advocate onboarding, marketing, legal compliance.
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 5vw", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.2vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Contact</div>
            <div style={{ fontSize: "2vw", color: "#F5F0E8", lineHeight: 1.6 }}>
              [Your Name]
            </div>
            <div style={{ fontSize: "1.8vw", color: "#B8B0A0", lineHeight: 1.6 }}>[Email address]</div>
            <div style={{ fontSize: "1.8vw", color: "#B8B0A0", lineHeight: 1.6 }}>[Phone / WhatsApp]</div>
          </div>
          <div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.2vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Resources</div>
            <div style={{ fontSize: "1.8vw", color: "#B8B0A0", lineHeight: 1.6 }}>Live demo: litigaforge.replit.app</div>
            <div style={{ fontSize: "1.8vw", color: "#B8B0A0", lineHeight: 1.6 }}>GitHub: github.com/arif806-cyber/litigaforge-ai</div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "4vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Confidential · May 2026</div>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>LitigaForge AI · 11 / 11</div>
      </div>
    </div>
  );
}
