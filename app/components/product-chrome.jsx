import Link from "next/link";
import { ArrowUpRightIcon, ChevronRightIcon } from "./icons";

export function BrandMark({ className = "" }) {
  return (
    <span className={`brand-cyber-hex ${className}`.trim()} aria-hidden="true" style={{ display: "inline-flex", verticalAlign: "middle" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="4"
          stroke="#F59E0B"
          strokeWidth="2"
          fill="rgba(245, 158, 11, 0.08)"
        />
        <path
          d="M9 8L15 12L9 16"
          stroke="#F5F2EB"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
