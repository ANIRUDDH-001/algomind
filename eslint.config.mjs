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
    "public/**",
    "public/vad/**"
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "prefer-const": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "warn",
      // Turned off: these flag valid SSR hydration patterns (syncing localStorage/external state
      // into React state on mount via useEffect). This is the recommended Next.js approach.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "warn",
      // Turned off: flags Math.random() in useRef() initializer as impure, but useRef
      // only evaluates its initializer once — this is a stable, idiomatic pattern.
      "react-hooks/purity": "off",
      "@next/next/no-img-element": "warn"
    }
  },
  // Test files: allow any types (mocking requires flexible typing)
  {
    files: ["**/__tests__/**", "**/*.test.*", "**/test-utils/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }]
    }
  }
]);

export default eslintConfig;
