"use client";

import { useEffect, useState, useRef } from "react";

const SHORTCUTS = [
  { key: "?", description: "Toggle keyboard shortcuts guide" },
  { key: "Esc", description: "Dismiss active dialog or mobile navigation" },
  { key: "Left / Right", description: "Cycle failure scenario tabs in simulator" },
  { key: "Tab", description: "Navigate focusable interactive controls" },
  { key: "Enter / Space", description: "Execute focused action or trigger replay" },
];

export function HotkeyGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (isOpen && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === "?" || (e.key === "/" && e.shiftKey)) && !["INPUT", "TEXTAREA"].includes(e.target?.tagName)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hotkey-trigger-btn"
        aria-label="Keyboard shortcuts (press ?)"
        style={{
          position: "fixed",
          bottom: "16px",
          right: "16px",
          zIndex: 40,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          color: "var(--muted, #94a3b8)",
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--mono)",
          fontSize: "12px",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        }}
      >
        ?
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hotkey-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(3, 7, 18, 0.75)",
        backdropFilter: "blur(12px)",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div
        style={{
          maxWidth: "440px",
          width: "100%",
          background: "#090d16",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "14px",
          padding: "24px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 id="hotkey-title" style={{ fontSize: "16px", fontWeight: "600", color: "#f8fafc", margin: 0 }}>
            Keyboard Shortcuts
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close keyboard shortcuts"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "16px",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {SHORTCUTS.map((sc) => (
            <div
              key={sc.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <span style={{ fontSize: "13px", color: "#94a3b8" }}>{sc.description}</span>
              <kbd
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "rgba(56, 189, 248, 0.12)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                }}
              >
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
