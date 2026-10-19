"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFWorker, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import { button, control } from "../../directory";
export function ProductionPdfPreview({ bytes, sha256, text }: { bytes: Uint8Array; sha256: string; text: string }) {
  const canvas = useRef<HTMLCanvasElement>(null); const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [number, setNumber] = useState(1); const [zoom, setZoom] = useState(1); const [status, setStatus] = useState("Loading PDF preview…");
  const [extractedText, setExtractedText] = useState("");
  useEffect(() => {
    let active = true; let port: Worker | undefined; let worker: PDFWorker | undefined; let task: PDFDocumentLoadingTask | undefined;
    setPdf(undefined); setNumber(1); setStatus("Loading PDF preview…"); setExtractedText("");
    if (canvas.current) canvas.current.getContext("2d")?.clearRect(0,0,canvas.current.width,canvas.current.height);
    void (async () => {
      const library = await import("pdfjs-dist/legacy/build/pdf.mjs"); if (!active) return;
      port = new Worker("/pdf.worker.min.mjs", { type: "module" }); worker = library.PDFWorker.create({ port });
      task = library.getDocument({ data: bytes.slice(), worker, useWasm: false, useWorkerFetch: false });
      const loaded = await task.promise; if (active) setPdf(loaded);
      if (!text) { const pages: string[] = []; for (let i=1;i<=loaded.numPages && active;i++) { const content = await (await loaded.getPage(i)).getTextContent(); pages.push(content.items.flatMap(item=>"str" in item ? [item.str] : []).join("\n")); } if(active) setExtractedText(pages.join("\n\n")); }
    })().catch(() => { if (active) setStatus("PDF preview failed. The frozen export bytes remain available; no replacement was generated."); });
    return () => { active = false; const clean = () => { worker?.destroy(); port?.terminate(); }; if (task) void task.destroy().then(clean, clean); else clean(); };
  }, [bytes, text]);
  useEffect(() => {
    if (!pdf) return; let active = true; let render: RenderTask | undefined;
    void pdf.getPage(number).then(async page => {
      if (!active || !canvas.current) return; const viewport = page.getViewport({ scale: zoom });
      canvas.current.width = Math.ceil(viewport.width); canvas.current.height = Math.ceil(viewport.height);
      const context = canvas.current.getContext("2d"); if (!context) throw new Error("Canvas unavailable");
      render = page.render({ canvas: canvas.current, canvasContext: context, viewport }); await render.promise;
      if (active) setStatus(`Previewing page ${number} of ${pdf.numPages} from the frozen export bytes.`);
    }).catch(() => { if (active) setStatus("This page could not be previewed. Export bytes are unchanged."); });
    return () => { active = false; render?.cancel(); };
  }, [pdf, number, zoom]);
  return <section aria-label="PDF preview" className="grid gap-3"><div className="flex flex-wrap gap-2"><button className={button} disabled={!pdf || number <= 1} onClick={() => setNumber(n => n - 1)}>Previous page</button><button className={button} disabled={!pdf || number >= pdf.numPages} onClick={() => setNumber(n => n + 1)}>Next page</button>
    <label>Zoom<select aria-label="PDF zoom" className={control} value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={.7}>70%</option><option value={1}>100%</option><option value={1.4}>140%</option></select></label></div>
    <p role="status" data-testid="pdf-preview-status">{status}</p><div className="overflow-auto rounded border bg-slate-100 p-2"><canvas ref={canvas} className="mx-auto bg-white" aria-label={`Resume PDF page ${number}`} /></div>
    <p className="break-all text-xs">PDF SHA-256: <span data-testid="pdf-hash">{sha256}</span></p><details><summary className="cursor-pointer underline">Accessible text from this layout</summary><pre className="whitespace-pre-wrap text-sm">{text || extractedText || "Extracting selectable PDF text…"}</pre></details>
  </section>;
}
