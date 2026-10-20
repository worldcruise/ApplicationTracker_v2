import { build, context } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import { productionConfig } from "../../../scripts/lib/production-config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../dist/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Expected a Manifest V3 extension.");

async function readSettings(url) {
  try { return parseEnv(await readFile(url, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return {}; throw error; }
}
// Explicit public allowlist only. Never inject process.env or a server credential.
const production=process.env.EXTENSION_BUILD_PROFILE==="production";
const web = production?{}:await readSettings(new URL("../../web/.env.local", import.meta.url));
const local = production?{}:await readSettings(new URL("../.env.local", import.meta.url));
const release=JSON.parse(await readFile(new URL("../../../releases/pilot.json",import.meta.url),"utf8"));
const config = {
  supabaseUrl: process.env.EXTENSION_PUBLIC_SUPABASE_URL ?? local.EXTENSION_PUBLIC_SUPABASE_URL ?? web.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  publishableKey: process.env.EXTENSION_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? local.EXTENSION_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? web.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  apiUrl: process.env.EXTENSION_PUBLIC_API_URL ?? local.EXTENSION_PUBLIC_API_URL ?? "http://localhost:3000/api/v1",
  clientVersion: production?release.extensionVersion:manifest.version,
};
if(production){productionConfig(process.env,true);manifest.version=release.extensionVersion;manifest.version_name=release.release;manifest.key=(await readFile(new URL("../../../releases/extension-public-key.txt",import.meta.url),"utf8")).trim();}
const origins = [new URL(config.apiUrl)];
if (config.supabaseUrl) origins.push(new URL(config.supabaseUrl));
for (const url of origins) {
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Use HTTPS origins (HTTP is allowed only for loopback development).");
  }
  if (url.username || url.password) throw new Error("Credentials must not appear in public URLs.");
}
let legacyAnon=false;
try { legacyAnon=JSON.parse(Buffer.from(config.publishableKey.split(".")[1], "base64url").toString()).role==="anon"; } catch { /* not a legacy JWT key */ }
if (config.publishableKey && !config.publishableKey.startsWith("sb_publishable_") && !legacyAnon) {
  throw new Error("Use a public publishable or legacy anon key; authenticated/service-role/secret keys are forbidden.");
}
// Chrome host match patterns do not scope ports; CSP uses the exact configured origins.
manifest.host_permissions = [...new Set(origins.map(url => `${url.protocol}//${url.hostname}/*`))];
manifest.content_security_policy.extension_pages =
  `script-src 'self'; object-src 'none'; connect-src 'self' ${origins.map(url => url.origin).join(" ")}; worker-src 'self'; font-src 'self' blob:; img-src 'self' data: blob:; style-src 'self'`;

await mkdir(output, { recursive: true });
await writeFile(new URL("manifest.json", output), JSON.stringify(manifest, null, 2) + "\n");
await copyFile(new URL("../workspace.html", import.meta.url), new URL("workspace.html", output));
const fontRoot = new URL("../../../packages/resume-engine/assets/fonts/", import.meta.url);
const fontManifest = JSON.parse(await readFile(new URL("manifest.json", fontRoot), "utf8"));
await mkdir(new URL("fonts/", output), { recursive: true });
for (const asset of fontManifest.files) {
  const bytes = await readFile(new URL(asset.file, fontRoot));
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error(`Bundled font/license hash mismatch: ${asset.file}`);
  await copyFile(new URL(asset.file, fontRoot), new URL(`fonts/${asset.file}`, output));
}
await copyFile(new URL("manifest.json", fontRoot), new URL("fonts/manifest.json", output));
await copyFile(new URL("../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), new URL("pdf.worker.min.mjs", output));
await copyFile(new URL("../../../node_modules/pdfjs-dist/LICENSE", import.meta.url), new URL("PDFJS-LICENSE.txt", output));

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
  define: { "process.env.NODE_ENV": '"production"', __EXTENSION_CONFIG__: JSON.stringify(config) },
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
