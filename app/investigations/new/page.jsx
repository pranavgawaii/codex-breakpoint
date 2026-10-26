"use client";
import Link from "next/link";
import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, InfoIcon, LockIcon, TerminalIcon } from "../../components/icons";
import { ProductHeader, StatusPill } from "../../components/product-chrome";
const plan = [
    "static shared-state analysis (no execution)",
    "triage runs — the most suspect files, up to three",
    "failing target test in isolation",
    "predecessor test in isolation",
    "whole file in declared order",
    "file again — reproducibility probe"
];
export default function NewInvestigation() {
    return (<div className="product-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <ProductHeader active="workspace" status={{ label: "Run plan ready", tone: "neutral" }}/>

      <main id="main" className="product-main">
        <div className="frame new-page">
          <Link className="workspace-back" href="/dashboard">
            <span aria-hidden="true">←</span>
            Back to workspace
          </Link>

          <header className="page-hero new-hero">
            <div className="page-hero-copy">
              <span className="page-kicker">
                New investigation <span aria-hidden="true">/</span> Run plan
              </span>
              <h1 className="setup-title">
                Configure a <span className="serif">controlled</span> run.
              </h1>
              <p className="setup-lede">
                The target is resolved from recorded failures, never hand-picked. Breakpoint only
                runs commands it builds itself from the test files discovered in the project.
              </p>
            </div>

            <div className="page-stepper">
              <span className="page-stepper-label">Execution plan</span>
              <span className="page-stepper-value">
                05 <i aria-hidden="true">/</i> runs
              </span>
              <span className="page-stepper-current">Fixed local commands</span>
            </div>
          </header>

          <div className="new-layout">
            <section className="config-card" aria-labelledby="config-heading">
              <div className="config-card-head">
                <div>
                  <span className="panel-eyebrow">Investigation setup</span>
                  <h2 id="config-heading">What should Breakpoint investigate?</h2>
                </div>
                <StatusPill label="Draft" tone="neutral"/>
              </div>

              <div className="config-form">
                <label className="form-field">
                  <span>Target test</span>
                  <input type="text" value="Resolved from triage failures or static analysis" readOnly />
                  <small>Resolved from recorded failures; not hand-picked from the browser.</small>
                </label>

                <label className="form-field">
                  <span>Investigation goal</span>
                  <textarea value="Prove which test sequence breaks which test, then verify a cleanup fix." readOnly rows={4}/>
                  <small>Fixed for every investigation so the reason for it stays visible.</small>
                </label>

                <div className="form-locked">
                  <LockIcon />
                  <div>
                    <strong>Commands are not editable.</strong>
                    <p>
                      Breakpoint never accepts a shell command or working directory from the
                      browser. Every execution is built from the tests discovered in the project.
                    </p>
                  </div>
                </div>
              </div>

              <div className="config-card-foot">
                <Link className="btn btn-secondary" href="/dashboard">
                  Cancel
                </Link>
                <Link className="btn btn-primary" href="/dashboard">
                  Open live workspace
                  <ArrowRightIcon />
                </Link>
              </div>
            </section>

            <aside className="plan-card" aria-labelledby="plan-heading">
              <div className="plan-card-head">
                <div>
                  <span className="panel-eyebrow">Permitted execution plan</span>
                  <h2 id="plan-heading">A fixed execution matrix.</h2>
                </div>
                <span className="plan-icon" aria-hidden="true">
                  <TerminalIcon />
                </span>
              </div>

              <p className="plan-lede">
                Each command runs inside the connected project directory with a scrubbed
                environment, a hard timeout and capped output.
              </p>

              <ol className="plan-list">
                {plan.map((step, index) => (<li key={step}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{step}</p>
                    <CheckIcon />
                  </li>))}
              </ol>

              <ul className="plan-badges" aria-label="Execution constraints">
                <li>
                  <CheckIcon /> Local only
                </li>
                <li>
                  <CheckIcon /> No secrets
                </li>
                <li>
                  <CheckIcon /> Review before apply
                </li>
              </ul>

              <div className="plan-note">
                <InfoIcon />
                <p>
                  The target may behave differently depending on order. That difference is the
                  evidence this investigation is designed to capture.
                </p>
              </div>

              <Link className="plan-secondary" href="/investigations/inv_session_state/summary">
                Open the existing report
                <ArrowUpRightIcon />
              </Link>
            </aside>
          </div>

          <footer className="product-page-foot">
            <p>
              Trusted local runs <span aria-hidden="true">·</span> fixed commands{" "}
              <span aria-hidden="true">·</span> explicit approval
            </p>
            <Link className="product-foot-link" href="/#workflow">
              How Breakpoint works
              <ArrowUpRightIcon />
            </Link>
          </footer>
        </div>
      </main>
    </div>);
}
