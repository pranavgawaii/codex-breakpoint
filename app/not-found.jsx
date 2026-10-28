import Link from "next/link";
import { ArrowRightIcon, ShieldCheckIcon } from "./components/icons";

export default function NotFound() {
  return (
    <main className="product-shell not-found-shell" style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--background)",
      padding: "24px",
      position: "relative"
    }}>

      <div className="not-found-block" style={{
        maxWidth: "540px",
        width: "100%",
        border: "1px solid var(--line-strong)",
        borderRadius: "20px",
        background: "var(--surface-glass)",
        backdropFilter: "blur(20px)",
        padding: "36px 32px",
        boxShadow: "var(--shadow-lift)",
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
          background: "linear-gradient(90deg, transparent, var(--accent), var(--danger), transparent)"
        }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "4px 12px", borderRadius: "999px", background: "var(--danger-soft)", border: "1px solid var(--danger)", marginBottom: "20px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--danger)", boxShadow: "0 0 8px var(--danger)" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: "11px", fontWeight: "700", color: "var(--danger-ink)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Anomaly Vector · 404 Not Found
          </span>
        </div>

        <h1 style={{
          fontSize: "32px",
          fontWeight: "700",
          color: "var(--ink)",
          letterSpacing: "-0.03em",
          marginBottom: "12px",
          lineHeight: "1.2"
        }}>
          Unresolved Route Node
        </h1>

        <p style={{
          color: "var(--muted)",
          fontSize: "14px",
          lineHeight: "1.65",
          marginBottom: "28px"
        }}>
          The telemetry kernel could not locate an active investigation run, test record, or resource at this URL coordinates. The route has been logged as an unmapped anomaly.
        </p>

        <div style={{
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          borderRadius: "10px",
          padding: "14px 16px",
          textAlign: "left",
          marginBottom: "28px",
          fontFamily: "var(--mono)",
          fontSize: "11px",
          color: "var(--faint)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--accent)" }}>STATUS: TRACE_RESOLVE_FAIL</span>
            <span style={{ color: "var(--danger)" }}>ERR_404</span>
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

        <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid var(--hairline)", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", color: "var(--faint)", fontSize: "11px", fontFamily: "var(--mono)" }}>
          <ShieldCheckIcon style={{ width: "13px", height: "13px", color: "var(--success)" }} />
          Local session state preserved · zero data loss
        </div>
      </div>
    </main>
  );
}
