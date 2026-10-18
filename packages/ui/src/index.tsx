import type { ReactNode } from "react";

export function WorkspaceShell({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="workspace-header">
        <span className="workspace-brand">Candidate Platform</span>
        <span className="workspace-badge">Development workspace</span>
      </header>
      <main id="main-content" className="workspace-main">
        <h1>{title}</h1>
        <p className="workspace-description">{description}</p>
        {children}
      </main>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <section className="workspace-card"><h2>{title}</h2><div>{children}</div></section>;
}
