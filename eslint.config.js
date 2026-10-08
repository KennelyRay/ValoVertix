import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "apps/web/public/mockServiceWorker.js",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Tokens and IDs must never reach the console; only sanitized helpers may log.
      "no-console": ["error", { allow: ["warn", "error"] }],
      // Security guardrails: no code from strings, no raw HTML. The CSP and Trusted
      // Types block these at runtime too; this stops them at review time.
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "No raw HTML: render text and elements instead.",
        },
        {
          selector:
            "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]",
          message: "No raw HTML: use textContent or React elements.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(insertAdjacentHTML|createContextualFragment)$/]",
          message: "No raw HTML.",
        },
        {
          selector:
            "CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/]",
          message: "No document.write.",
        },
      ],
    },
  },
  {
    files: ["scripts/**", "apps/*/scripts/**"],
    rules: { "no-console": "off" },
  },
);
