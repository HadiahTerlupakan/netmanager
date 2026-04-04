import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".worktrees/**",
      "prisma/generated/**",
      "scripts/**",
      "temp_genieacs_source/**",
      ".next/**",
      "out/**",
      "public/sw.js",
      "public/sw.js.map",
      "public/workbox-*.js",
      "public/worker-*.js"
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ]
    }
  },
  {
    files: ["app/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/modules/*/repositories/**"],
              message: "UI layer must not import repositories directly. Use API boundary instead."
            },
            {
              group: ["@/modules/*/services/**"],
              message: "UI layer should not call module services directly. Use API boundary instead."
            },
            {
              group: ["@/lib/prisma", "@/lib/prisma*"],
              message: "UI layer must not access Prisma directly."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["app/api/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/modules/*/repositories/**"],
              message: "API routes should not import repositories directly. Use module public API/service facade."
            },
            {
              group: ["@/modules/*/**"],
              message: "API routes should import modules via public entrypoint (@/modules/<module>)."
            },
            {
              group: ["@/lib/prisma", "@/lib/prisma*"],
              message: "API routes should avoid direct Prisma usage; move orchestration to service/repository layers."
            }
          ]
        }
      ],
      "no-restricted-syntax": [
        "warn",
        {
          selector: "ImportExpression[source.value=/^@\\/modules\\/[^/]+\\/.+/]",
          message: "API routes should dynamic-import modules via public entrypoint (@/modules/<module>) only."
        },
        {
          selector: "ImportExpression[source.value=/^@\\/lib\\/prisma/]",
          message: "API routes should avoid dynamic-importing Prisma directly; move orchestration to service/repository layers."
        }
      ]
    }
  }
];

export default eslintConfig;
