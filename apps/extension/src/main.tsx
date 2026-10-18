import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { EmptyState, WorkspaceShell } from "@candidate/ui";
import "@candidate/ui/styles.css";

function ExtensionWorkspace() {
  const [view, setView] = useState<"resume" | "profile">("resume");

  return (
    <WorkspaceShell title="Candidate workspace" description="Prepare resumes and review your selected candidate profile.">
      <nav className="workspace-views" aria-label="Workspace views">
        <button type="button" aria-pressed={view === "resume"} onClick={() => setView("resume")}>Resume</button>
        <button type="button" aria-pressed={view === "profile"} onClick={() => setView("profile")}>Profile</button>
      </nav>
      {view === "resume" ? (
        <EmptyState title="Prepare a resume">
          <p>Account connection and candidate selection are coming next. Resume preparation will be available after setup.</p>
        </EmptyState>
      ) : (
        <EmptyState title="No candidate selected">
          <p>Your authorized candidate profile will appear here after you connect your account.</p>
        </EmptyState>
      )}
    </WorkspaceShell>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Workspace root element is missing.");
createRoot(root).render(<StrictMode><ExtensionWorkspace /></StrictMode>);
