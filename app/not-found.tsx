import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="product-shell not-found-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem"
      }}
    >
      <div style={{ maxWidth: "480px" }}>
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: "0.85rem",
            color: "var(--accent, #4f46e5)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "0.5rem"
          }}
        >
          404 — Not Found
        </p>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 600,
            color: "var(--ink, #0a0a0f)",
            margin: "0 0 1rem"
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            color: "var(--muted, #5e6472)",
            fontSize: "0.95rem",
            lineHeight: 1.5,
            marginBottom: "1.5rem"
          }}
        >
          The requested investigation or resource could not be found.
        </p>
        <Link
          href="/"
          className="btn btn-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            textDecoration: "none"
          }}
        >
          Return to Breakpoint home
        </Link>
      </div>
    </main>
  );
}
