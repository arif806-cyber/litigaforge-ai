import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const revenueData = [
  { tier: "Free", monthly: 0 },
  { tier: "Professional", monthly: 999 },
  { tier: "Advocate Pro", monthly: 2499 },
];

export default function Slide07Market() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />

      <div style={{ position: "absolute", top: "7vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.6vh", lineHeight: 1.2 }}>
          90M citizens, 8M annual court filings — with a clear three-tier revenue model already live
        </div>
        <div style={{ width: "4vw", height: "2px", background: "#C8933F", marginBottom: "3.5vh" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 5vw", alignItems: "start" }}>
          <div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.8vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Market Size</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh", marginBottom: "2.5vh" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #2A3540", paddingBottom: "1.2vh" }}>
                <div style={{ fontSize: "1.8vw", color: "#B8B0A0" }}>Total population (TG + AP)</div>
                <div style={{ fontSize: "2vw", fontWeight: 700, color: "#F5F0E8" }}>90M+</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #2A3540", paddingBottom: "1.2vh" }}>
                <div style={{ fontSize: "1.8vw", color: "#B8B0A0" }}>Annual court filings (TG + AP)</div>
                <div style={{ fontSize: "2vw", fontWeight: 700, color: "#F5F0E8" }}>~8M</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #2A3540", paddingBottom: "1.2vh" }}>
                <div style={{ fontSize: "1.8vw", color: "#B8B0A0" }}>Registered advocates (TG + AP)</div>
                <div style={{ fontSize: "2vw", fontWeight: 700, color: "#F5F0E8" }}>~100K+</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: "1.8vw", color: "#B8B0A0" }}>Growth path</div>
                <div style={{ fontSize: "1.7vw", fontWeight: 600, color: "#C8933F" }}>TG &amp; AP → South India → National</div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", marginBottom: "1.8vh", textTransform: "uppercase", letterSpacing: "0.1em" }}>Revenue per Subscriber — Monthly (INR)</div>
            <div style={{ width: "100%", height: "30vh", minHeight: "180px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3540" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => v === 0 ? "Free" : `₹${v.toLocaleString()}`} tick={{ fill: "#7A7A7A", fontSize: "1.3vw" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="tier" tick={{ fill: "#B8B0A0", fontSize: "1.5vw" }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip formatter={(v: number) => v === 0 ? "Free" : `₹${v.toLocaleString()}/mo`} contentStyle={{ background: "#1A2430", border: "1px solid #2A3540", color: "#F5F0E8", fontSize: "1.4vw" }} />
                  <Bar dataKey="monthly" radius={2} label={{ position: "right", fill: "#B8B0A0", fontSize: "1.3vw", formatter: (v: number) => v === 0 ? "" : `₹${v.toLocaleString()}` }}>
                    <Cell fill="#2A3540" />
                    <Cell fill="#C8933F" />
                    <Cell fill="#E8B55F" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: "1.3vw", color: "#7A7A7A", marginTop: "1vh" }}>Source: Razorpay plan configuration, internal pricing model · May 2026</div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "4vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Confidential · May 2026</div>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>LitigaForge AI · 7 / 10</div>
      </div>
    </div>
  );
}
