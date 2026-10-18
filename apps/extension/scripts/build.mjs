import { build, context } from "esbuild";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../dist/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Expected a Manifest V3 extension.");

await mkdir(output, { recursive: true });
await copyFile(new URL("../manifest.json", import.meta.url), new URL("manifest.json", output));
await copyFile(new URL("../workspace.html", import.meta.url), new URL("workspace.html", output));

const options = {
  absWorkingDir: root,
  entryPoints: { workspace: "src/main.tsx", "service-worker": "src/service-worker.ts" },
  outdir: "dist",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome120",
  jsx: "automatic",
  minify: true,
  sourcemap: false,
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
};

// No process.env bulk replacement: arbitrary server secrets cannot enter the bundle.
if (process.argv.includes("--watch")) {
  const watcher = await context(options);
  await watcher.watch();
  console.log("Watching extension sources. Reload the unpacked extension after rebuilding.");
} else {
  await build(options);
}
