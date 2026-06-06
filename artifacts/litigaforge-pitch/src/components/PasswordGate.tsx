import { useState, useEffect, type ReactNode } from "react";

const DECK_PASSWORD = import.meta.env.VITE_DECK_PASSWORD || "LitigaForge@2026";
const SESSION_KEY = "lf_deck_auth";

interface Props {
  children: ReactNode;
}

export default function PasswordGate({ children }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === DECK_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setInput("");
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0F1923",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "min(420px, 90vw)",
          padding: "48px 40px",
          border: "1px solid #1E2D3D",
          borderTop: "3px solid #C8933F",
          background: "#111C27",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          animation: shake ? "shake 0.5s ease" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              background: "#C8933F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F1923" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#F5F0E8", lineHeight: 1.2 }}>
              LitigaForge AI
            </div>
            <div style={{ fontSize: "13px", color: "#7A7A7A", marginTop: "2px" }}>
              Investor & Partner Deck · Confidential
            </div>
          </div>
        </div>

        <div style={{ width: "100%", height: "1px", background: "#1E2D3D" }} />

        <div>
          <div style={{ fontSize: "14px", color: "#B8B0A0", marginBottom: "20px" }}>
            This presentation is confidential. Enter the access code to continue.
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input
              type="password"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false); }}
              placeholder="Access code"
              autoFocus
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "#0F1923",
                border: `1px solid ${error ? "#ef4444" : "#2A3540"}`,
                color: "#F5F0E8",
                fontSize: "15px",
                outline: "none",
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
            />
            {error && (
              <div style={{ fontSize: "13px", color: "#ef4444" }}>
                Incorrect access code. Please try again.
              </div>
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                background: "#C8933F",
                border: "none",
                color: "#0F1923",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.05em",
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                textTransform: "uppercase",
              }}
            >
              View Deck
            </button>
          </form>
        </div>

        <div style={{ fontSize: "12px", color: "#3A4A5A", textAlign: "center" }}>
          © 2026 LitigaForge AI · All rights reserved
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
