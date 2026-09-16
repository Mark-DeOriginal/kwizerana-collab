import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    // These React 19 advisory rules are useful for new code, but enabling them
    // as blocking errors would require a broad behavioral rewrite of existing
    // data-loading hooks. Keep the established runtime behavior during this
    // framework upgrade and address them incrementally.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off"
    }
  },
  globalIgnores([
    ".next/**",
    ".next-stale-*/**",
    "out/**",
    "build/**",
    "contracts/artifacts/**",
    "contracts/cache/**",
    "_tmp_debug.js",
    "next-env.d.ts"
  ]),
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  }
]);
