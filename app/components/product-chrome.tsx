import Link from "next/link";
import { ArrowUpRightIcon, ChevronRightIcon } from "./icons";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`bp-mark ${className}`.trim()} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export type StatusTone = "neutral" | "warning" | "success" | "danger";

export function StatusPill({
  label,
  tone = "neutral",
  className = ""
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span className={`status-pill status-pill--${tone} ${className}`.trim()}>
      <span className="status-pill-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function ProductHeader({
  active = "projects",
  status,
  projectName = "breakpoint-session-demo"
}: {
  active?: "projects" | "workspace";
  status?: { label: string; tone: StatusTone };
  projectName?: string;
}) {
  return (
    <header className="product-bar">
      <div className="frame product-bar-inner">
        <Link className="product-brand" href="/">
          <BrandMark />
          <span>Breakpoint</span>
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
            <span aria-hidden="true" />
            Local only
          </span>
          {status && <StatusPill label={status.label} tone={status.tone} />}
          <Link className="product-exit" href="/">
            Exit to site
            <ArrowUpRightIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}
