import { EmptyState, WorkspaceShell } from "@candidate/ui";

// The proxy may refresh a session even on this public shell; do not use ISR.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <WorkspaceShell
      title="Your candidate workspace"
      description="Keep candidate profiles, resume preparation, and application activity together."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <EmptyState title="Candidate management">
          <p>Sign-in and candidate management are coming next. No candidate records are connected yet.</p>
        </EmptyState>
        <EmptyState title="Resume and application work">
          <p>Prepare documents and track applications from one workspace. These features will become available after account setup.</p>
        </EmptyState>
      </div>
    </WorkspaceShell>
  );
}
