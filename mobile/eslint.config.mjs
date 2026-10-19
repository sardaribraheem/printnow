import typescriptRules from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

// Reuse the root's TypeScript tooling without applying Next.js page/DOM rules.
export default [
  ...typescriptRules,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
