"use client";

import { useState } from "react";
import { CheckIcon, FileIcon } from "./icons";

export function DiffView({ patch, compact = false }) {
  const [copied, setCopied] = useState(false);
  const diffText = patch?.diff || "";
  const lines = diffText ? diffText.split("\n") : [];

  let additions = 0;
  let deletions = 0;
  lines.forEach((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  });

  const handleCopy = async () => {
    if (!diffText) return;
    try {
      await navigator.clipboard.writeText(diffText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API unavailable
    }
  };

  return (
    <div className={`diff-view ${compact ? "diff-view--compact" : ""}`.trim()}>
      <div className="diff-view-head">
        <span className="diff-file">
          <FileIcon />
          {patch?.targetPath || "patch.diff"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="diff-baseline">{patch?.baseline || "baseline"}</span>
          {(additions > 0 || deletions > 0) && (
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: "10px",
                display: "inline-flex",
                gap: "5px",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              {additions > 0 && <span style={{ color: "#34d399" }}>+{additions}</span>}
              {deletions > 0 && <span style={{ color: "#f87171" }}>-{deletions}</span>}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy diff patch to clipboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 8px",
              fontSize: "10px",
              fontFamily: "var(--mono)",
              background: copied ? "rgba(52, 211, 153, 0.15)" : "rgba(255, 255, 255, 0.06)",
              color: copied ? "#34d399" : "var(--faint)",
              border: `1px solid ${copied ? "rgba(52, 211, 153, 0.3)" : "rgba(255, 255, 255, 0.1)"}`,
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {copied ? (
              <>
                <CheckIcon style={{ width: "10px", height: "10px" }} />
                <span>Copied</span>
              </>
            ) : (
              <span>Copy Diff</span>
            )}
          </button>
        </div>
      </div>
      <pre className="diff-code" aria-label="Proposed patch">
        {lines.length > 0 ? (
          lines.map((line, index) => {
            const tone =
              line.startsWith("+") && !line.startsWith("+++")
                ? "add"
                : line.startsWith("-") && !line.startsWith("---")
                ? "del"
                : "context";
            return (
              <span className={`diff-line diff-line--${tone}`} key={`${line}-${index}`}>
                <span className="diff-line-number">{index + 1}</span>
                <span>{line || " "}</span>
              </span>
            );
          })
        ) : (
          <span className="diff-line diff-line--context" style={{ padding: "8px 16px", color: "var(--faint)" }}>
            No diff recorded.
          </span>
        )}
      </pre>
    </div>
  );
}
