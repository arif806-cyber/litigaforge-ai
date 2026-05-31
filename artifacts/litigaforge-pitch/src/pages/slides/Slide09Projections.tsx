import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const data = [
  { year: "Y1",  revenue: 12,    costs: 28,    profit: -16   },
  { year: "Y2",  revenue: 68,    costs: 55,    profit: 13    },
  { year: "Y3",  revenue: 210,   costs: 120,   profit: 90    },
  { year: "Y4",  revenue: 580,   costs: 240,   profit: 340   },
  { year: "Y5",  revenue: 1400,  costs: 480,   profit: 920   },
  { year: "Y6",  revenue: 2800,  costs: 840,   profit: 1960  },
  { year: "Y7",  revenue: 5200,  costs: 1400,  profit: 3800  },
  { year: "Y8",  revenue: 8500,  costs: 2200,  profit: 6300  },
  { year: "Y9",  revenue: 12500, costs: 3200,  profit: 9300  },
  { year: "Y10", revenue: 18000, costs: 4500,  profit: 13500 },
];

const fmt = (v: number) => {
  if (Math.abs(v) >= 10000) return `₹${(v / 10000).toFixed(1)}Cr`;
  if (Math.abs(v) >= 100) return `₹${v}L`;
  return `₹${v}L`;
};

export default function Slide09Projections() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: "#0F1923", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100vh", background: "#C8933F" }} />

      <div style={{ position: "absolute", top: "5.5vh", left: "7vw", right: "7vw" }}>
        <div style={{ fontSize: "2.4vw", fontWeight: 700, color: "#F5F0E8", marginBottom: "0.5vh", lineHeight: 1.2 }}>
          Revenue reaches &#8377;180 Cr and profit &#8377;135 Cr by Year 10 — break-even achieved in Year 2
        </div>
        <div style={{ width: "4vw", height: "2px", background: "#C8933F", marginBottom: "2vh" }} />

        <div style={{ width: "100%", height: "42vh", minHeight: "240px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D3D" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#B8B0A0", fontSize: "1.25vw" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#B8B0A0", fontSize: "1.2vw" }} axisLine={false} tickLine={false} width={70} />
              <Tooltip
                formatter={(v: number, name: string) => [fmt(v), name]}
                contentStyle={{ background: "#1A2430", border: "1px solid #2A3540", color: "#F5F0E8", fontSize: "1.3vw" }}
              />
              <Legend wrapperStyle={{ fontSize: "1.25vw", color: "#B8B0A0", paddingTop: "8px" }} />
              <Bar dataKey="revenue" name="Revenue" fill="#C8933F" opacity={0.85} radius={[2,2,0,0]} />
              <Bar dataKey="costs" name="Operating Costs" fill="#2A3F52" radius={[2,2,0,0]} />
              <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#6EE7B7" strokeWidth={2.5} dot={{ fill: "#6EE7B7", r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{ fontSize: "1.2vw", color: "#7A7A7A", marginBottom: "1.8vh" }}>
          Source: Internal model — 0.5% TG/AP capture by Y5, pan-India expansion Y6–Y10, blended ARPU ₹1,200/mo · All figures INR Lakhs · [Unverified estimates]
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0 1.5vw" }}>
          <div style={{ borderTop: "2px solid #2A3540", paddingTop: "1.2vh" }}>
            <div style={{ fontSize: "1.25vw", fontWeight: 700, color: "#C8933F", marginBottom: "0.5vh" }}>Year 5</div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#F5F0E8" }}>&#8377;14 Cr</div>
            <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Revenue</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 600, color: "#6EE7B7", marginTop: "0.3vh" }}>&#8377;9.2 Cr</div>
            <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Profit</div>
          </div>
          <div style={{ borderTop: "2px solid #2A3540", paddingTop: "1.2vh" }}>
            <div style={{ fontSize: "1.25vw", fontWeight: 700, color: "#C8933F", marginBottom: "0.5vh" }}>Year 6</div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#F5F0E8" }}>&#8377;28 Cr</div>
            <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Revenue</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 600, color: "#6EE7B7", marginTop: "0.3vh" }}>&#8377;19.6 Cr</div>
            <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Profit</div>
          </div>
          <div style={{ borderTop: "2px solid #2A3540", paddingTop: "1.2vh" }}>
            <div style={{ fontSize: "1.25vw", fontWeight: 700, color: "#C8933F", marginBottom: "0.5vh" }}>Year 7</div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#F5F0E8" }}>&#8377;52 Cr</div>
            <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Revenue</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 600, color: "#6EE7B7", marginTop: "0.3vh" }}>&#8377;38 Cr</div>
            <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Profit</div>
          </div>
          <div style={{ borderTop: "2px solid #2A3540", paddingTop: "1.2vh" }}>
            <div style={{ fontSize: "1.25vw", fontWeight: 700, color: "#C8933F", marginBottom: "0.5vh" }}>Year 9</div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#F5F0E8" }}>&#8377;125 Cr</div>
            <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Revenue</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 600, color: "#6EE7B7", marginTop: "0.3vh" }}>&#8377;93 Cr</div>
            <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Profit</div>
          </div>
          <div style={{ borderTop: "2px solid #C8933F", paddingTop: "1.2vh" }}>
            <div style={{ fontSize: "1.25vw", fontWeight: 700, color: "#C8933F", marginBottom: "0.5vh" }}>Year 10</div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#F5F0E8" }}>&#8377;180 Cr</div>
            <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Revenue</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 600, color: "#6EE7B7", marginTop: "0.3vh" }}>&#8377;135 Cr</div>
            <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Profit</div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "4vh", left: "7vw", right: "7vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>Confidential · May 2026 · All projections unverified internal estimates</div>
        <div style={{ fontSize: "1.2vw", color: "#7A7A7A" }}>LitigaForge AI · 9 / 10</div>
      </div>
    </div>
  );
}
