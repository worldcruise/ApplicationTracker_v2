import { copyFile, mkdir } from "node:fs/promises";
const output = new URL("../public/", import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(new URL("../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), new URL("pdf.worker.min.mjs", output));
await copyFile(new URL("../../../node_modules/pdfjs-dist/LICENSE", import.meta.url), new URL("PDFJS-LICENSE.txt", output));
