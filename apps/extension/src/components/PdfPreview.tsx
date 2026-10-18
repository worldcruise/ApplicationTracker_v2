import { useEffect, useRef, useState } from "react";
import { getDocument, PDFWorker, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { StoredSample } from "../sample-pdf";

export function PdfPreview({ sample }: { sample: StoredSample }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [message, setMessage] = useState("Loading PDF preview…");

  useEffect(() => {
    let active = true;
    setDocument(undefined);
    setPageNumber(1);
    let port: Worker | undefined;
    let worker: PDFWorker | undefined;
    let task: PDFDocumentLoadingTask | undefined;
    try {
      // Supply an explicit local worker, avoiding PDF.js's cross-origin Blob wrapper.
      port = new Worker(chrome.runtime.getURL("pdf.worker.min.mjs"), { type: "module" });
      worker = PDFWorker.create({ port });
      // PDF.js transfers/consumes its input buffer. Preserve immutable export bytes.
      task = getDocument({ data: sample.bytes.slice(), worker, useWasm: false, useWorkerFetch: false });
      task.promise.then(value => { if (active) setDocument(value); })
        .catch(() => { if (active) setMessage("PDF.js could not load the preview. The stored PDF remains available; check Chrome/CSP support."); });
    } catch { setMessage("The local PDF preview worker is unsupported or blocked. Export bytes are preserved."); }
    return () => {
      active = false;
      const cleanup = () => { worker?.destroy(); port?.terminate(); };
      if (task) void task.destroy().then(cleanup, cleanup);
      else cleanup();
    };
  }, [sample]);

  useEffect(() => {
    if (!document) return;
    let active = true;
    let rendering: RenderTask | undefined;
    setMessage(`Rendering page ${pageNumber}…`);
    document.getPage(pageNumber).then(async page => {
      if (!active || !canvas.current) return;
      const viewport = page.getViewport({ scale });
      canvas.current.width = Math.ceil(viewport.width);
      canvas.current.height = Math.ceil(viewport.height);
      const context = canvas.current.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      rendering = page.render({ canvas: canvas.current, canvasContext: context, viewport });
      await rendering.promise;
      if (active) setMessage(`Previewing page ${pageNumber} of ${document.numPages} from the stored export bytes.`);
    }).catch(() => { if (active) setMessage("Page preview failed. No new PDF was generated or substituted."); });
    return () => { active = false; rendering?.cancel(); };
  }, [document, pageNumber, scale]);

  return <div className="pdf-preview">
    <div className="probe-actions">
      <button disabled={!document || pageNumber <= 1} onClick={() => setPageNumber(value => value - 1)}>Previous page</button>
      <button disabled={!document || pageNumber >= document.numPages} onClick={() => setPageNumber(value => value + 1)}>Next page</button>
      <label>Zoom <select value={scale} onChange={event => setScale(Number(event.target.value))}><option value={.8}>80%</option><option value={1.2}>120%</option><option value={1.6}>160%</option></select></label>
    </div>
    <p role="status" aria-live="polite">{message}</p>
    <canvas ref={canvas} aria-label={`Synthetic resume PDF preview, page ${pageNumber}. A text view follows.`} />
  </div>;
}
