import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Brand() {
  return <span className="brand-lockup"><span className="brand-mark" aria-hidden="true">a<span>t</span></span><span>Application Tracker v2</span></span>;
}

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return <button className={`ui-button ui-button-${variant} ${className}`} {...props} />;
}

export function StatusBadge({ value, children }: { value: string; children?: ReactNode }) {
  const tone = /^(ready|approved|succeeded|completed|reviewed|active|offer|accepted|verified)$/.test(value) ? "success"
    : /^(failed|rejected|cancelled|error|withdrawn)$/.test(value) ? "danger"
    : /^(pending|unknown|overdue|awaiting_review|feedback_pending|unverified|urgent)$/.test(value) ? "warning" : "neutral";
  return <span className={`status-badge status-${tone}`}>{children ?? value.replaceAll("_", " ")}</span>;
}

export function StatePanel({ title, children, kind = "empty" }: { title: string; children: ReactNode; kind?: "empty" | "error" | "success" | "loading" | "permission" }) {
  return <div className={`state-panel state-${kind}`} role={kind === "error" || kind === "permission" ? "alert" : "status"}><span className="state-symbol" aria-hidden="true">{kind === "success" ? "✓" : kind === "error" || kind === "permission" ? "!" : "◇"}</span><h3>{title}</h3><div>{children}</div></div>;
}

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="workspace-shell auth-shell"><a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="auth-story"><a href="/" className="auth-brand"><Brand /></a><div className="auth-story-copy"><span className="eyebrow">A focused place to work</span><h2>People. Possibilities.<br /><span>Progress.</span></h2><p>Bring candidate profiles, thoughtful resumes and every opportunity into one organized workspace.</p><div className="auth-feature"><span>01</span> Build a verified candidate profile</div><div className="auth-feature"><span>02</span> Create and review tailored documents</div><div className="auth-feature"><span>03</span> Keep the next opportunity moving</div></div><p className="auth-footnote">Candidate management & resume production</p></aside>
    <main id="main-content" className="auth-main"><a href="/" className="auth-mobile-brand"><Brand /></a><div className="auth-content"><span className="eyebrow">Your workspace, connected</span><h1>{title}</h1><p className="workspace-description">{description}</p>{children}</div><footer>Application Tracker v2 <span>·</span> Local pilot workspace</footer></main>
  </div>;
}

export function WorkspaceShell({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="workspace-header">
        <span className="workspace-brand"><Brand /></span>
        <span className="workspace-badge">Development workspace</span>
      </header>
      <main id="main-content" className="workspace-main">
        <div className="page-heading"><span className="eyebrow">Your workspace</span><h1>{title}</h1>
        <p className="workspace-description">{description}</p></div>
        {children}
      </main>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <section className="workspace-card"><span className="eyebrow">Explore your workspace</span><h2>{title}</h2><div>{children}</div></section>;
}
