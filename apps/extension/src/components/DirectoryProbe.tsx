import { useEffect, useState } from "react";
import { chooseDirectory, DirectoryProbeError, pickerSupported, renewDirectory, restoreDirectory, type DirectorySelection } from "../directory";

export function DirectoryProbe() {
  const [selection, setSelection] = useState<DirectorySelection>({ permission: "none" });
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("Checking stored directory permission…");
  const supported = pickerSupported();

  useEffect(() => {
    let active = true;
    restoreDirectory().then(value => { if (active) { setSelection(value); setMessage("Stored handle checked without requesting permission."); } })
      .catch(() => { if (active) { setSelection({ permission: "error" }); setMessage("Stored folder check failed. This does not mean no folder was selected."); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function update(work: Promise<DirectorySelection>) {
    setBusy(true);
    try { setSelection(await work); setMessage("Selection and permission check completed."); }
    catch (error) {
      if (!(error instanceof DirectoryProbeError && error.message.startsWith("Selection cancelled"))) {
        setSelection(value => ({ ...value, permission: "error" }));
      }
      setMessage(error instanceof DirectoryProbeError ? error.message : "Folder check failed. Existing selection is preserved.");
    }
    finally { setBusy(false); }
  }

  return <section className="workspace-card probe-card" aria-labelledby="directory-title">
    <h2 id="directory-title">2. Local directory</h2>
    <p>Select a dedicated synthetic-test folder. Reopening never renews permissions automatically.</p>
    <p>Selected root: <strong>{selection.handle?.name ?? "No verified selection"}</strong></p>
    <p>Read/write permission: <strong>{busy ? "checking" : selection.permission}</strong></p>
    <div className="probe-actions">
      <button disabled={busy || !supported} onClick={() => void update(chooseDirectory())}>Choose test folder</button>
      <button disabled={busy || !selection.handle} onClick={() => void update(renewDirectory(selection.handle!))}>Renew permission</button>
      <button disabled={busy} onClick={() => void update(restoreDirectory())}>Recheck stored handle</button>
    </div>
    {!supported && <p>Directory picking is unsupported in this context. Use a full Chrome extension workspace page.</p>}
    <p role="status" aria-live="polite">{message}</p>
    <p>The browser exposes a folder handle and display name, not an absolute path. Opening an OS folder and permanent permission are unsupported.</p>
  </section>;
}
