import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  { ignores: ["dist/**", "src/db/migrations/**", "**/*.config.*", "worker-configuration.d.ts"] },
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
      globals: { fetch: "readonly", crypto: "readonly", console: "readonly" },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      // TypeScript already enforces no-undef; turning it off avoids false positives
      // on DOM/Worker globals across the two tsconfigs.
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
];
