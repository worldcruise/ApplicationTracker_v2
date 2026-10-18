import { useEffect, useState } from "react";
import { renderFeasibilityResume, syntheticResume } from "@candidate/resume-engine";
import { DIRECTORY_KEY, localStore } from "../local-store";
import { ACTIVE_SAMPLE, assertFrozenSample, initialOutcome, loadSample, outcomeKey, pdfBlob, sampleKey, saveSampleToDirectory, type SampleOutcome, type StoredSample } from "../sample-pdf";
import { PdfPreview } from "./PdfPreview";

export function PdfProbe() {
  const [sample, setSample] = useState<StoredSample>();
  const [outcome, setOutcome] = useState<SampleOutcome>(initialOutcome());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking stored synthetic PDF…");
  useEffect(() => {
    let active = true;
    loadSample().then(async value => {
      if (!active) return;
      setSample(value);
      setMessage(value ? "Stored PDF hash verified. Preview and export use this snapshot." : "Generate the synthetic sample to test rendering.");
      if (value) {
        const previous = await localStore().get<SampleOutcome>(outcomeKey(value.operationId));
        if (active) setOutcome(previous ?? initialOutcome());
      }
    }).catch(() => { if (active) setMessage("Stored PDF check failed. Existing generation/save results are unknown."); });
    return () => { active = false; };
  }, []);

  async function generate() {
    setBusy(true);
    setMessage("Generating a new synthetic document snapshot…");
    try {
      const asset = async (name: string) => {
        const response = await fetch(chrome.runtime.getURL(`fonts/${name}`));
        if (!response.ok) throw new Error("Bundled font asset unavailable.");
        return new Uint8Array(await response.arrayBuffer());
      };
      const [regular, bold, manifestResponse] = await Promise.all([asset("NotoSans-Regular.ttf"), asset("NotoSans-Bold.ttf"), fetch(chrome.runtime.getURL("fonts/manifest.json"))]);
      if (!manifestResponse.ok) throw new Error("Font manifest unavailable.");
      const manifest = await manifestResponse.json();
      const fixture = structuredClone(syntheticResume);
      const rendered = await renderFeasibilityResume({ regular, bold }, fixture);
      const value: StoredSample = {
        ...rendered, operationId: crypto.randomUUID(), schemaVersion: 1, createdAt: new Date().toISOString(), fixture,
        templateVersion: "phase0-classic-v1", rendererVersion: "phase0-1",
        fontHashes: Object.fromEntries(manifest.files.map((entry: { file: string; sha256: string }) => [entry.file, entry.sha256])),
      };
      await localStore().addWithPointer(sampleKey(value.operationId), value, ACTIVE_SAMPLE, value.operationId);
      setSample(value);
      setOutcome(initialOutcome());
      setMessage(`Generated and persisted ${value.pageCount} pages. Earlier snapshots remain immutable in local storage.`);
    } catch { setMessage("PDF generation or snapshot persistence failed. The previous snapshot is preserved; check bundled font support and local storage."); }
    finally { setBusy(false); }
  }

  async function updateOutcome(patch: Partial<SampleOutcome>) {
    const value = await localStore().merge(outcomeKey(sample!.operationId), initialOutcome(), patch);
    setOutcome(value);
  }

  async function save() {
    if (!sample) return;
    setBusy(true);
    let fileVerified = false;
    try {
      await updateOutcome({ localSave: "pending" });
      if (!navigator.locks) throw new Error("Web Locks are unavailable; simultaneous file writes are unsupported.");
      await navigator.locks.request(`candidate-save:${sample.operationId}`, async () => {
        const handle = await localStore().get<FileSystemDirectoryHandle>(DIRECTORY_KEY);
        if (!handle) throw new Error("Choose a test folder first.");
        await saveSampleToDirectory(handle, sample);
      });
      fileVerified = true;
      await updateOutcome({ localSave: "succeeded" });
      setMessage("Local PDF write closed and its hash was verified. No database synchronization or submission occurred.");
    } catch (error) {
      if (fileVerified) {
        setOutcome(value => ({ ...value, localSave: "succeeded" }));
        setMessage("The local file hash was verified, but the result journal could not be persisted. Recheck the same operation after reopening.");
        return;
      }
      try { await updateOutcome({ localSave: "failed" }); }
      catch { setOutcome(value => ({ ...value, localSave: "failed" })); }
      setMessage(`${error instanceof Error ? error.message : "Local save failed."} A file may be incomplete; inspect before retrying.`);
    } finally { setBusy(false); }
  }

  async function download() {
    if (!sample) return;
    setBusy(true);
    let initiated = false;
    try {
      await assertFrozenSample(sample);
      const url = URL.createObjectURL(await pdfBlob(sample));
      const link = document.createElement("a");
      link.href = url;
      link.download = `synthetic-resume__${sample.operationId}.pdf`;
      link.click();
      initiated = true;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      await updateOutcome({ download: "initiated" });
      setMessage("Download initiated from the stored PDF bytes. The browser cannot confirm you kept the file.");
    } catch {
      const status = initiated ? "initiated" : "failed";
      try { await updateOutcome({ download: status }); }
      catch { setOutcome(value => ({ ...value, download: status })); }
      setMessage(initiated ? "Download initiated, but its result journal could not be persisted. Keeping the file is unconfirmed." : "Download failed before initiation. Local saving and database synchronization are independent.");
    }
    finally { setBusy(false); }
  }

  return <section className="workspace-card probe-card" aria-labelledby="pdf-title">
    <h2 id="pdf-title">3. Synthetic resume PDF</h2>
    <p>One classic feasibility layout with bundled Noto Sans. This does not validate or publish real candidate content.</p>
    <div className="probe-actions">
      <button disabled={busy} onClick={() => void generate()}>Generate synthetic PDF</button>
      <button disabled={busy || !sample} onClick={() => void save()}>Save exact PDF to selected folder</button>
      <button disabled={busy || !sample} onClick={() => void download()}>Download exact PDF</button>
    </div>
    <p role="status" aria-live="polite">{message}</p>
    <p>Local save: <strong>{outcome.localSave}</strong> · Download: <strong>{outcome.download}</strong> · Database sync: <strong>{outcome.databaseSync}</strong></p>
    {sample && <>
      <p>Operation: <code>{sample.operationId}</code></p><p>PDF SHA-256: <code>{sample.sha256}</code></p>
      <PdfPreview sample={sample} />
      <details><summary>Accessible synthetic text view</summary>
        <h3>{sample.fixture.snapshot.name}</h3><p>{sample.fixture.content.summary}</p>
        <p>{sample.fixture.content.skills.flatMap(category => Object.entries(category).map(([key, values]) => `${key}: ${values.join(", ")}`)).join("; ")}</p>
        {sample.fixture.content.experience.map((role, index) => <section key={index}><h4>{role.title} · {role.company}</h4><ul>{role.sentences.map((text, item) => <li key={item}>{text}</li>)}</ul></section>)}
        <p>{sample.fixture.content.education.map(entry => entry.degree).join("; ")}</p>
      </details>
    </>}
  </section>;
}
