import { readFile, writeFile, mkdir } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import standalone from "ajv/dist/standalone/index.js";
const schema = JSON.parse(await readFile(new URL("../src/schemas/resume-v1.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true, code: { source: true, esm: true, lines: true } });
const code = "// @ts-nocheck\n// Generated from unchanged resume-v1.json by compile-resume-schema.mjs; do not edit.\n" + standalone(ajv, ajv.compile(schema)) + "\n";
const target = new URL("../src/generated/resume-v1.ts", import.meta.url);
if (process.argv.includes("--check")) {
  if (await readFile(target, "utf8") !== code) throw new Error("Generated resume validator is stale. Run npm run schema:compile.");
} else { await mkdir(new URL("../src/generated/", import.meta.url), { recursive: true }); await writeFile(target, code); }
