"use client";
import { useEffect, useState } from "react";
import type { FrozenDocument, OrganizationScope } from "@candidate/contracts";
import { readApi } from "@/app/workspace/requests";
import { pdfDigest } from "@/lib/resumes/journal";
import { ProductionPdfPreview } from "@/app/candidates/[candidateId]/studio/pdf-preview";
import { button, control } from "@/app/candidates/directory";
import { StatePanel } from "@candidate/ui";
type StoredPdf = { bytes: Uint8Array; sha256: string; filename: string; id: string };
export function DocumentHistory({ scope, candidateId, refresh = 0 }: { scope: OrganizationScope; candidateId?: string; refresh?: number }) {
  const [rows, setRows] = useState<FrozenDocument[]>([]); const [pdf, setPdf] = useState<StoredPdf | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [bidId, setBidId] = useState("");
  const [loadState, setLoadState] = useState("pending"); const [retry, setRetry] = useState(0);
  const query = `organizationId=${scope.organizationId}${candidateId ? `&candidateId=${candidateId}` : ""}`;
  useEffect(() => { let active = true; setRows([]); setPdf(null); setLoadState("pending");
    void readApi<FrozenDocument[]>(`/api/v1/documents?${query}`).then(data => { if (active) { setRows(data); setLoadState("succeeded"); } }, e => { if (active) { setLoadState("failed"); setMessage(e instanceof Error ? e.message : "History lookup failed."); } });
    return () => { active = false; };
  }, [query, refresh, retry]);
  async function retrieve(row: FrozenDocument) {
    const result = await readApi<{ id: string; base64: string; sha256: string; filename: string }>(`/api/v1/documents/${row.id}/pdf?organizationId=${scope.organizationId}`);
    const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
    if (await pdfDigest(bytes) !== row.pdfSha256 || result.sha256 !== row.pdfSha256) throw new Error("Stored PDF integrity check failed. Preview/export blocked.");
    const next = { bytes, sha256: result.sha256, filename: result.filename, id: result.id }; setPdf(next); return next;
  }
  return <section className="grid gap-3 rounded border bg-white p-4" aria-label="Frozen document history"><h2 className="text-lg font-semibold">Frozen document history</h2>
    <p className="text-sm">Most recent 100 documents in your current scope. PDF retrieval checks current export permission. Stored versions preserve exact bytes; saving or exporting never submits an application.</p>
    {message && <p role={loadState === "failed" ? "alert" : "status"}>{message}</p>}
    {loadState === "pending" && <p role="status">Loading authorized document history…</p>}
    {loadState === "failed" && <button className={button} onClick={() => { setMessage(""); setRetry(n => n + 1); }}>Retry document history</button>}
    <ul className="grid gap-3">{rows.map(row => <li key={row.id} className="rounded border p-3"><p>{row.kind === "resume" ? "Resume" : "Cover letter"} · {row.filename} · {row.reviewed ? "Facts reviewed" : "Unverified"}</p><p className="text-xs">{new Date(row.createdAt).toLocaleString()} · {row.pageCount} pages · {row.byteSize} bytes</p>
      <div className="my-2 flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={async () => { setBusy(true); try { await retrieve(row); setMessage("Retrieved the stored PDF and verified its hash."); } catch (e) { setPdf(null); setMessage(e instanceof Error ? e.message : "Retrieval failed."); } finally { setBusy(false); } }}>Preview stored {row.kind === "resume" ? "resume" : "letter"}</button>
        <button className={button} disabled={busy} onClick={async () => { setBusy(true); try {
          // Reauthorize each export, including when a preview is already open.
          const file = await retrieve(row); const url = URL.createObjectURL(new Blob([new Uint8Array(file.bytes)], { type: "application/pdf" })); const a = document.createElement("a"); a.href = url; a.download = file.filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); setMessage("Download initiated. The browser cannot confirm that the file was kept.");
        } catch (e) { setMessage(e instanceof Error ? e.message : "Export failed."); } finally { setBusy(false); } }}>Export stored PDF</button>
        {(scope.role === "admin" || scope.role === "team_leader") && <button className={button} disabled={busy || !bidId || !row.reviewed} onClick={async () => { setBusy(true); try { await readApi(`/api/v1/documents/${row.id}/links?organizationId=${scope.organizationId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bidId }) }); setMessage("Frozen document linked to the authorized bid. This does not grant bidder access or submission approval."); } catch (e) { setMessage(e instanceof Error ? e.message : "Link failed."); } finally { setBusy(false); } }}>Link to bid</button>}
      </div><details className="text-xs"><summary>Version and integrity metadata</summary><dl className="break-all"><dt>Document</dt><dd>{row.id}</dd><dt>Schema</dt><dd>{row.schemaVersion}</dd><dt>Template</dt><dd>{row.templateVersionId}</dd><dt>Renderer</dt><dd>{row.rendererVersion}</dd><dt>PDF SHA-256</dt><dd>{row.pdfSha256}</dd><dt>Font/assets</dt><dd>{JSON.stringify(row.assetHashes)}</dd></dl></details>
    </li>)}</ul>{loadState === "succeeded" && !rows.length && <StatePanel title="No frozen documents yet"><p>No stored documents returned in your authorized scope. Source-only versions appear in their editors.</p></StatePanel>}
    {(scope.role === "admin" || scope.role === "team_leader") && <label className="text-sm">Bid reference for linking<input className={control} value={bidId} onChange={e => setBidId(e.target.value)} placeholder="Existing authorized bid UUID" /></label>}
    {pdf && <ProductionPdfPreview bytes={pdf.bytes} sha256={pdf.sha256} text="" />}
  </section>;
}
