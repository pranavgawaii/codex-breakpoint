import Link from "next/link";
import { ArrowUpRightIcon, ChevronRightIcon } from "./icons";
export function BrandMark({ className = "" }) {
    return (<span className={`bp-mark ${className}`.trim()} aria-hidden="true">
      <span className="bp-mark-reticle" />
      <i />
      <i />
      <i />
    </span>);
}
export function StatusPill({ label, tone = "neutral", className = "" }) {
    return (<span className={`status-pill status-pill--${tone} ${className}`.trim()}>
      <span className="status-pill-dot" aria-hidden="true"/>
      <span className="status-pill-text">{label}</span>
    </span>);
}
export function ProductHeader({ active = "projects", status, projectName = "Workspace" }) {
    return (<header className="product-bar">
      <div className="frame product-bar-inner">
        <Link className="product-brand" href="/">
          <BrandMark />
          <span>Breakpoint</span>
        </Link>

        <span className="product-bar-rule" aria-hidden="true"/>

        <nav className="product-breadcrumb" aria-label="Product breadcrumb">
          <Link href="/app" className={active === "projects" ? "is-current" : undefined} aria-current={active === "projects" ? "page" : undefined}>
            Projects
          </Link>
          {active === "workspace" && (<>
              <ChevronRightIcon className="breadcrumb-chevron"/>
              <span className="breadcrumb-project">{projectName}</span>
            </>)}
        </nav>

        <div className="product-bar-actions">
          <span className="local-chip">
            <span className="pulse-dot-green" aria-hidden="true"/>
            <span>Deterministic engine</span>
          </span>
          {status && <StatusPill label={status.label} tone={status.tone}/>}
          <Link className="product-exit" href="/">
            <span>Exit to site</span>
            <ArrowUpRightIcon />
          </Link>
        </div>
      </div>
    </header>);
}
