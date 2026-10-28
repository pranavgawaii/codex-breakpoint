"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export function ModernNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`modern-nav-wrapper ${scrolled ? "is-scrolled" : ""}`}>
      <nav className="modern-nav-island" aria-label="Main Navigation">
        <Link href="/" className="modern-brand">
          <span className="brand-cyber-hex" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
          <span className="brand-text">
            BREAKPOINT
            <span className="brand-badge">v2.4</span>
          </span>
        </Link>

        <div className="modern-links desktop-only">
          <a href="#reproducer" className="modern-link">Replay Engine</a>
          <a href="#failures" className="modern-link">Failure Modes</a>
          <a href="#architecture" className="modern-link">Architecture</a>
          <a href="#matrix" className="modern-link">Evidence Matrix</a>
          <Link href="/dashboard" className="modern-link highlight">Workspace</Link>
        </div>

        <div className="modern-actions">
          <div className="system-status-indicator desktop-only">
            <span className="status-ping" aria-hidden="true" />
            <span className="status-text">KERNEL ONLINE</span>
          </div>

          <Link href="/app" className="btn-modern-primary">
            <span>Launch Studio</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>

          <button
            type="button"
            className="mobile-hamburger-btn mobile-only"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-drawer">
          <a href="#reproducer" onClick={() => setMobileMenuOpen(false)}>Replay Engine</a>
          <a href="#failures" onClick={() => setMobileMenuOpen(false)}>Failure Modes</a>
          <a href="#architecture" onClick={() => setMobileMenuOpen(false)}>Architecture</a>
          <a href="#matrix" onClick={() => setMobileMenuOpen(false)}>Evidence Matrix</a>
          <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>Workspace</Link>
          <Link href="/app" className="btn-modern-primary w-full" onClick={() => setMobileMenuOpen(false)}>
            Launch Studio
          </Link>
        </div>
      )}
    </header>
  );
}
