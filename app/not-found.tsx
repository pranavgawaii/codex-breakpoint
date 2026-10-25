import Link from "next/link";

export default function NotFound() {
  return (
    <main className="product-shell not-found-shell">
      <div className="not-found-block">
        <p className="not-found-kicker">404 — Not Found</p>
        <h1 className="not-found-title">Page not found</h1>
        <p className="not-found-body">
          The requested investigation or resource could not be found.
        </p>
        <Link href="/" className="btn btn-primary">
          Return to Breakpoint home
        </Link>
      </div>
    </main>
  );
}
