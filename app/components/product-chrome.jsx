import Link from "next/link";
import { ArrowUpRightIcon, ChevronRightIcon } from "./icons";

export function BrandMark({ className = "" }) {
  return (
    <span className={`brand-cyber-hex ${className}`.trim()} aria-hidden="true" style={{ display: "inline-flex", verticalAlign: "middle" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <polygon
          points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"
          stroke="#00f0ff"
          strokeWidth="2"
          fill="rgba(0, 240, 255, 0.12)"
        />
        <circle cx="12" cy="12" r="3" fill="#00f0ff" />
      </svg>
    </span>
  );
}

export function StatusPill({ label, tone = "neutral", className = "" }) {
  return (
    <span className={`status-pill status-pill--${tone} ${className}`.trim()}>
      <span className="status-pill-dot" aria-hidden="true" />
      <span className="status-pill-text">{label}</span>
    </span>
  );
}

export function ProductHeader({ active = "projects", status, projectName = "Workspace" }) {
  return (
    <header className="product-bar">
      <div className="frame product-bar-inner">
        <Link className="product-brand" href="/">
          <BrandMark />
          <span style={{ fontFamily: "var(--font-display, inherit)", fontWeight: 700, letterSpacing: "0.04em" }}>BREAKPOINT</span>
        </Link>

        <span className="product-bar-rule" aria-hidden="true" />

        <nav className="product-breadcrumb" aria-label="Product breadcrumb">
          <Link href="/app" className={active === "projects" ? "is-current" : undefined} aria-current={active === "projects" ? "page" : undefined}>
            Projects
          </Link>
          {active === "workspace" && (
            <>
              <ChevronRightIcon className="breadcrumb-chevron" />
              <span className="breadcrumb-project">{projectName}</span>
            </>
          )}
        </nav>

        <div className="product-bar-actions">
          <span className="local-chip">
            <span className="pulse-dot-green" aria-hidden="true" />
            <span>Deterministic engine</span>
          </span>
          {status && <StatusPill label={status.label} tone={status.tone} />}
          <Link className="product-exit" href="/">
            <span>Exit to site</span>
            <ArrowUpRightIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}
