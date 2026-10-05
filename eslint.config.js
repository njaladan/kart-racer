import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["vendor/**", "assets/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "tests/**/*.js", "*.js", "*.mjs", "tools/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Callbacks may accept context fields without consuming every argument.
      "no-unused-vars": ["error", { args: "none", varsIgnorePattern: "^_" }],
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      camelcase: ["error", { properties: "never", ignoreDestructuring: true }],
    },
  },
];
