import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["vendor/**", "assets/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "tests/**/*.js", "*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Legacy rendering callbacks intentionally accept unused context fields.
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      camelcase: ["error", { properties: "never", ignoreDestructuring: true }],
    },
  },
];
