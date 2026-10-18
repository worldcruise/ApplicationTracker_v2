import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { EmptyState, WorkspaceShell } from "@candidate/ui";
import "@candidate/ui/styles.css";
import { AuthProbe } from "./components/AuthProbe";
import { DirectoryProbe } from "./components/DirectoryProbe";
import { PdfProbe } from "./components/PdfProbe";
import "./workspace.css";

function ExtensionWorkspace() {
  const [view, setView] = useState<"resume" | "profile">("resume");

  return (
    <WorkspaceShell title="Candidate workspace" description="Prepare resumes and review your selected candidate profile.">
      <p className="probe-notice">Phase 0 checks use synthetic data only. Saving or exporting a sample does not submit an application.</p>
      <AuthProbe />
      <nav className="workspace-views" aria-label="Workspace views">
        <button type="button" aria-pressed={view === "resume"} onClick={() => setView("resume")}>Resume</button>
        <button type="button" aria-pressed={view === "profile"} onClick={() => setView("profile")}>Profile</button>
      </nav>
      {view === "resume" ? (
        <><DirectoryProbe /><PdfProbe /></>
      ) : (
        <EmptyState title="No candidate selected">
          <p>The sign-in probe verifies identity only. Application membership, candidate selection, and profile permissions remain later tasks.</p>
        </EmptyState>
      )}
    </WorkspaceShell>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Workspace root element is missing.");
createRoot(root).render(<StrictMode><ExtensionWorkspace /></StrictMode>);
