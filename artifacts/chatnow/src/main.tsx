import { createRoot } from "react-dom/client";
  import { Component, type ReactNode } from "react";
  import App from "./App";
  import "./index.css";

  class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    constructor(props: { children: ReactNode }) {
      super(props);
      this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error) {
      return { error };
    }

    render() {
      if (this.state.error) {
        return (
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#0b0c10",
              color: "#fff",
              fontFamily: "Inter, system-ui, sans-serif",
              padding: "2rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠️</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Bir şeyler ters gitti
            </h1>
            <p style={{ color: "#8a8d91", fontSize: "0.9rem", maxWidth: "400px" }}>
              Uygulama başlatılırken hata oluştu. Sayfayı yenilemeyi deneyin.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: "1.5rem",
                padding: "0.6rem 1.5rem",
                background: "#7c3aed",
                border: "none",
                borderRadius: "0.5rem",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 600,
              }}
            >
              Yenile
            </button>
            {import.meta.env.DEV && (
              <pre
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  background: "#1a1b1e",
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                  color: "#f87171",
                  maxWidth: "600px",
                  overflow: "auto",
                  textAlign: "left",
                }}
              >
                {this.state.error.message}
              </pre>
            )}
          </div>
        );
      }
      return this.props.children;
    }
  }

  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  