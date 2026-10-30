import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default defineConfig([
  ...compat.extends("next/core-web-vitals"),
  // TypeScript used to catch undefined references; enforce no-undef now that
  // the codebase is plain JavaScript.
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    rules: { "no-undef": "error" },
  },
  globalIgnores([".next/**", ".next-stale-*/**", "node_modules/**", ".breakpoint/**", ".breakpoint-e2e*/**", ".github/**"])
]);
