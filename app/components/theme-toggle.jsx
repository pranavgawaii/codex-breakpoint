"use client";

import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState("warm");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("breakpoint-theme");
    const current = stored || document.documentElement.getAttribute("data-theme") || "warm";
    setTheme(current);
    document.documentElement.setAttribute("data-theme", current);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "warm" ? "dark" : "warm";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      localStorage.setItem("breakpoint-theme", nextTheme);
    } catch {
      // Ignore localStorage errors in private mode
    }
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className={`theme-toggle-btn ${className}`.trim()}
        aria-label="Toggle theme"
        disabled
        style={{ opacity: 0 }}
      >
        <span className="theme-toggle-indicator" />
      </button>
    );
  }

  const isWarm = theme === "warm";

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${isWarm ? "is-warm" : "is-dark"} ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={`Switch to ${isWarm ? "dark" : "warm"} theme`}
      title={`Current: ${isWarm ? "Warm Light" : "Dark"} (Click to switch)`}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isWarm ? (
          /* Warm Sun Icon */
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" fill="rgba(217, 119, 6, 0.25)" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          /* Moon Icon */
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="rgba(14, 165, 233, 0.25)" />
          </svg>
        )}
      </span>
      <span className="theme-toggle-label">
        {isWarm ? "Warm" : "Dark"}
      </span>
    </button>
  );
}
