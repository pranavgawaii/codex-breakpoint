import type { Metadata } from "next";
import InvestigationWorkspace from "./workspace";

export const metadata: Metadata = { title: "Live workspace — Breakpoint" };

export default function DashboardPage() {
  return <InvestigationWorkspace />;
}
