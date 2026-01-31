import { dirname } from "path";
import { fileURLToPath } from "url";
import next from "eslint-config-next";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [
  ...next,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "**/*.d.ts",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.ts",
      "tmp/**",
      "dist/**",
      "public/sw.js",
      "public/workbox-*.js",
      "public/worker-*.js"
    ]
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
];

export default eslintConfig;
