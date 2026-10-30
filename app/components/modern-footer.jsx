import Link from "next/link";

export function ModernFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="modern-footer-root">
      <div className="footer-top-rule" />
      <div className="modern-footer-container">
        <div className="footer-main-grid">
          {/* Brand Info */}
          <div className="footer-brand-col">
            <div className="footer-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="4"
                  stroke="#38BDF8"
                  strokeWidth="2"
                  fill="rgba(56, 189, 248, 0.12)"
                />
                <path
                  d="M9 8L15 12L9 16"
                  stroke="#F5F2EB"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="footer-brand-name">BREAKPOINT</span>
            </div>

            <p className="footer-tagline">
              The deterministic test runtime for distributed codebases. Reproduce, isolate, and verify flaky failures at kernel speed.
            </p>

            <div className="footer-status-pill">
              <span className="status-pulse-green" />
              <span className="status-label">ALL RUNNERS OPERATIONAL · v2.4.2</span>
            </div>
          </div>

          {/* Links Grid */}
          <div className="footer-links-col">
            <span className="footer-col-title">RUNTIME ENGINE</span>
            <ul className="footer-link-list">
              <li><a href="#reproducer">Interactive Simulator</a></li>
              <li><a href="#failures">Order Mutation Bisection</a></li>
              <li><a href="#architecture">Memory Isolation Sandbox</a></li>
              <li><a href="#matrix">Deterministic Proof Matrix</a></li>
            </ul>
          </div>

          <div className="footer-links-col">
            <span className="footer-col-title">INTEGRATIONS</span>
            <ul className="footer-link-list">
              <li><Link href="/app">Node.js (node:test)</Link></li>
              <li><Link href="/app">Python (pytest engine)</Link></li>
              <li><Link href="/dashboard">Local Workspace Studio</Link></li>
              <li><Link href="/investigations/new">Run Plan Configurator</Link></li>
            </ul>
          </div>

          <div className="footer-links-col">
            <span className="footer-col-title">ECOSYSTEM</span>
            <ul className="footer-link-list">
              <li><a href="https://github.com/pranavgawaii/codex-breakpoint" target="_blank" rel="noopener noreferrer">GitHub Repository</a></li>
              <li><Link href="/investigations/inv_session_state/summary">Sample Audit Certificate</Link></li>
              <li><Link href="/dashboard">CI Failure Replay</Link></li>
              <li><a href="#top">Back to Top &uarr;</a></li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="footer-bottom-bar">
          <div className="footer-copyright">
            &copy; {year} Breakpoint Runtime &middot; Apache 2.0 Open Source &middot; Built for DevDay Exchange Metro Hackathon
          </div>
          <div className="footer-meta-tags">
            <span className="meta-tag">LOCAL-FIRST</span>
            <span className="meta-tag">ZERO-REMOTE EXFILTRATION</span>
            <span className="meta-tag">NODE 20+</span>
            <span className="meta-tag">PY 3.11+</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
