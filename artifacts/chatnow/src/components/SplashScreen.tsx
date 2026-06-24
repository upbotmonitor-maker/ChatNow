import { useEffect, useState } from "react";

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2700);
    const doneTimer = setTimeout(() => onDone(), 3300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#0b0c10",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.6s ease",
        pointerEvents: fading ? "none" : "all",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "18px" }}>
        <svg
          width="88"
          height="88"
          viewBox="0 0 88 88"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx="44"
            cy="44"
            r="38"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
            fill="none"
          />
          <circle
            cx="44"
            cy="44"
            r="30"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
            fill="none"
          />
          <circle
            cx="44"
            cy="44"
            r="38"
            stroke="white"
            strokeWidth="1.2"
            fill="none"
            strokeDasharray="60 180"
            strokeLinecap="round"
            filter="url(#glow)"
            style={{
              transformOrigin: "44px 44px",
              animation: "spin 3s linear infinite",
            }}
          />
          <circle
            cx="44"
            cy="44"
            r="22"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1"
            fill="none"
            filter="url(#glow)"
          />
          <circle cx="44" cy="44" r="4.5" fill="white" filter="url(#glow)" />
          <line
            x1="44"
            y1="25"
            x2="44"
            y2="39.5"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <line
            x1="57"
            y1="38"
            x2="48.5"
            y2="42.5"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>

        <div
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "26px",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.03em",
          }}
        >
          ChatNow
        </div>

        <div
          style={{
            width: "22px",
            height: "22px",
            border: "1.5px solid rgba(255,255,255,0.15)",
            borderTop: "1.5px solid rgba(255,255,255,0.85)",
            borderRadius: "50%",
            animation: "spin 0.9s linear infinite",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "28px",
          display: "flex",
          alignItems: "center",
          gap: "7px",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "13px",
        }}
      >
        <span style={{ color: "#8a8d91" }}>from</span>
        <span style={{ color: "#ffffff", fontWeight: 500 }}>Go Labs</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ marginLeft: "1px" }}
        >
          <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.4" />
          <ellipse cx="12" cy="12" rx="4.2" ry="10" stroke="white" strokeWidth="1.4" />
          <line x1="2" y1="12" x2="22" y2="12" stroke="white" strokeWidth="1.4" />
          <line x1="4.5" y1="7" x2="19.5" y2="7" stroke="white" strokeWidth="1.2" />
          <line x1="4.5" y1="17" x2="19.5" y2="17" stroke="white" strokeWidth="1.2" />
        </svg>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
