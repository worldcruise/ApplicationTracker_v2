import { EmptyState, WorkspaceShell } from "@candidate/ui";
import Link from "next/link";

// The proxy may refresh a session even on this public shell; do not use ISR.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <WorkspaceShell
      title="Your candidate workspace"
      description="Keep candidate profiles, resume preparation, and application activity together."
    >
      <nav className="mb-6 flex gap-5 underline"><Link href="/sign-in">Sign in</Link><Link href="/workspace">Open workspace</Link><Link href="/account/recovery">Account recovery</Link></nav>
      <div className="grid gap-5 md:grid-cols-2">
        <EmptyState title="Candidate management">
          <p>Open your workspace to view candidates within your current organization and assignment scope.</p>
        </EmptyState>
        <EmptyState title="Resume and application work">
          <p>Open a candidate’s Resume Studio to validate JSON, preview and export a PDF with ATS Classic, then track each opportunity as a separate bid.</p>
        </EmptyState>
      </div>
    </WorkspaceShell>
  );
}
