import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const projectionData = [
  { year: "Y1", revenue: 12, costs: 28 },
  { year: "Y2", revenue: 68, costs: 55 },
  { year: "Y3", revenue: 210, costs: 120 },
  { year: "Y4", revenue: 580, costs: 240 },
  { year: "Y5", revenue: 1400, costs: 480 },
];

export default function Slide09Projections() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />

      <div style={{ position: "absolute", top: "7vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.6vh", lineHeight: 1.2 }}>
          5-year projection: revenue crosses break-even in Year 2, reaching ~&#8377;14 Cr by Year 5
        </div>
        <div style={{ width: "4vw", height: "2px", background: "#C8933F", marginBottom: "2.5vh" }} />

        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "0 4vw", alignItems: "start" }}>
          <div>
            <div style={{ width: "100%", height: "35vh", minHeight: "200px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3540" />
                  <XAxis dataKey="year" tick={{ fill: "#B8B0A0", fontSize: "1.3vw" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `₹${v}L`} tick={{ fill: "#B8B0A0", fontSize: "1.3vw" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => `₹${v}L`} contentStyle={{ background: "#1A2430", border: "1px solid #2A3540", color: "#F5F0E8", fontSize: "1.3vw" }} />
                  <Legend wrapperStyle={{ fontSize: "1.3vw", color: "#B8B0A0" }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#C8933F" strokeWidth={2.5} dot={{ fill: "#C8933F", r: 4 }} />
                  <Line type="monotone" dataKey="costs" name="Costs" stroke="#4A5568" strokeWidth={2} dot={{ fill: "#4A5568", r: 3 }} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: "1.2vw", color: "#7A7A7A", marginTop: "0.8vh", lineHeight: 1.4 }}>
              Source: Internal model — 0.5% TG/AP market capture by Y5, blended ARPU ₹1,200/mo · INR Lakhs · [Unverified estimates]
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.4vh" }}>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#C8933F", textTransform: "uppercase", letterSpacing: "0.1em" }}>Key Assumptions</div>
            <div style={{ fontSize: "1.75vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Year 1:</span> Beta, 80 advocates, 500 paying clients. Seed covers ops.</div>
            <div style={{ fontSize: "1.75vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Year 2:</span> Series A, all 16 APIs live, 400 advocates, Hyderabad + Vijayawada.</div>
            <div style={{ fontSize: "1.75vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Year 3:</span> Break-even approached. South India expansion — KA, TN.</div>
            <div style={{ fontSize: "1.75vw", color: "#E0D8CC", lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: "#F5F0E8" }}>Year 5:</span> Pan-India. 52K clients, 9.5K advocates, ₹14 Cr run-rate.</div>
            <div style={{ padding: "1.4vh 1.5vw", background: "#1A2430", borderLeft: "2px solid #C8933F", marginTop: "0.5vh" }}>
              <div style={{ fontSize: "1.65vw", color: "#B8B0A0", lineHeight: 1.4 }}>Break-even at ~2,500 paying subscribers (blended ARPU). Burn covered by seed through 18 months of beta.</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "4vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Confidential · May 2026 · All projections unverified internal estimates</div>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>LitigaForge AI · 9 / 11</div>
      </div>
    </div>
  );
}
