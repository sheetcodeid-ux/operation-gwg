import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React Compiler performance advisory (not a correctness rule). Our
      // intentional effects — localStorage hydration, reset-on-close, session
      // sync — are correct as written; keep it visible as a warning rather than
      // failing CI. Real correctness rules stay errors.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
