import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**", "**/.next/**", "**/dist/**", ".tools/**",
    ".npm-cache/**", "supabase/.temp/**", "supabase/.branches/**",
    "apps/web/next-env.d.ts",
    "packages/contracts/src/generated/**",
  ]),
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/**/*.{js,mjs,ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  { settings: { next: { rootDir: "apps/web/" } } },
]);
