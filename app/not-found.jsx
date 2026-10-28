import Link from "next/link";
import { BrandMark } from "./components/brand-mark";
import { ArrowRightIcon, TerminalIcon, ShieldCheckIcon } from "./components/icons";

export default function NotFound() {
  return (
    <main className="product-shell not-found-shell" style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(ellipse at center, rgba(14, 165, 233, 0.08) 0%, #080A0F 70%)",
      padding: "24px",
      position: "relative"
    }}>
      <div className="not-found-block" style={{
        maxWidth: "540px",
        width: "100%",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "20px",
        background: "rgba(13, 18, 31, 0.75)",
        backdropFilter: "blur(20px)",
        padding: "36px 32px",
        boxShadow: "0 24px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px -10px rgba(14, 165, 233, 0.15)",
        textAlign: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(90deg, transparent, #0ea5e9, #f43f5e, transparent)"
        }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "4px 12px", borderRadius: "999px", background: "rgba(244, 63, 94, 0.1)", border: "1px solid rgba(244, 63, 94, 0.3)", marginBottom: "20px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f43f5e", boxShadow: "0 0 8px #f43f5e" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: "11px", fontWeight: "700", color: "#fb7185", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Anomaly Vector · 404 Not Found
          </span>
        </div>

        <h1 style={{
          fontSize: "32px",
          fontWeight: "700",
          color: "#f8fafc",
          letterSpacing: "-0.03em",
          marginBottom: "12px",
          lineHeight: "1.2"
        }}>
          Unresolved Route Node
        </h1>

        <p style={{
          color: "#94a3b8",
          fontSize: "14px",
          lineHeight: "1.65",
          marginBottom: "28px"
        }}>
          The telemetry kernel could not locate an active investigation run, test record, or resource at this URL coordinates. The route has been logged as an unmapped anomaly.
        </p>

        <div style={{
          background: "rgba(9, 12, 20, 0.8)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "10px",
          padding: "14px 16px",
          textAlign: "left",
          marginBottom: "28px",
          fontFamily: "var(--mono)",
          fontSize: "11px",
          color: "#64748b"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "#38bdf8" }}>STATUS: TRACE_RESOLVE_FAIL</span>
            <span style={{ color: "#f43f5e" }}>ERR_404</span>
          </div>
          <div>TRACE: kernel::route_table::lookup() -&gt; null</div>
          <div>RECOVERY: fallback to primary telemetry hub</div>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" className="btn btn-primary" style={{ padding: "10px 20px", fontSize: "13px" }}>
            Return to Telemetry Home
            <ArrowRightIcon />
          </Link>
          <Link href="/dashboard" className="btn btn-secondary" style={{ padding: "10px 20px", fontSize: "13px" }}>
            Open Workspace
          </Link>
        </div>

        <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid rgba(255, 255, 255, 0.06)", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "11px", fontFamily: "var(--mono)" }}>
          <ShieldCheckIcon style={{ width: "13px", height: "13px", color: "#10b981" }} />
          Local session state preserved · zero data loss
        </div>
      </div>
    </main>
  );
}
