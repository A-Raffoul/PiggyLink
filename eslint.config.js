import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

// TypeScript is checked by `tsc` (typescript-eslint does not support TS 7 yet).
export default [
  { ignores: ["dist/", "coverage/", "node_modules/", "src/vendor/", "**/*.ts"] },
  js.configs.recommended,
  prettier,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
