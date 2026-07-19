import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const reactHookMigrationRules = Object.fromEntries(
  Object.entries(reactHooks.configs.flat.recommended.rules).map(([name, value]) => [
    name,
    Array.isArray(value) ? ["warn", ...value.slice(1)] : "warn"
  ])
);

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "apps/client/dist/**",
      "apps/server/data/scenarios/**/map/tiles/**",
      "apps/server/uploads/**"
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": "allow-with-description",
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 12
        }
      ],
      "no-empty": ["error", { allowEmptyCatch: false }]
    }
  },
  {
    files: ["apps/client/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks
    },
    rules: {
      ...reactHookMigrationRules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  },
  {
    files: ["**/*.test.ts"],
    languageOptions: {
      globals: {
        describe: "readonly",
        expect: "readonly",
        it: "readonly"
      }
    }
  },
  {
    files: ["scripts/**/*.{mjs,cjs}", "apps/server/scripts/**/*.{ts,mjs}", "apps/server/src/**/*.ts"],
    languageOptions: {
      globals: {
        AbortController: "readonly",
        Buffer: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        process: "readonly",
        require: "readonly",
        setTimeout: "readonly"
      }
    }
  },
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  }
);
