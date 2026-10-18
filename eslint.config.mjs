import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next*/**",
    ".next-marketplace/**",
    ".printnow-files/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
