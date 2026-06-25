import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const MODULE_PUBLIC_API_IMPORT_MESSAGE =
  "Lintas module wajib import via public API (@/modules/<module>) atau entrypoint publik yang disepakati.";
const MODULE_INTERNAL_SUBPATH_PATTERNS = [
  "@/modules/*/repositories/**",
  "@/modules/*/services/**",
  "@/modules/*/domain/**",
  "@/modules/*/dto/**",
  "@/modules/*/types/**",
  "@/modules/*/mappers/**",
  "@/modules/*/factories/**",
  "@/modules/*/validators/**",
  "@/modules/*/utils/**"
];
/** Build restricted import patterns for module boundary guardrails. */
function createModuleBoundaryPatterns() {
  return [
    {
      group: MODULE_INTERNAL_SUBPATH_PATTERNS,
      message: MODULE_PUBLIC_API_IMPORT_MESSAGE
    },
    {
      group: ["@/lib/prisma", "@/lib/prisma*"],
      message: "Layer ini tidak boleh mengakses Prisma secara langsung."
    }
  ];
}

/** Build syntax restrictions for dynamic internal module imports. */
function createDynamicModuleBoundaryRules() {
  return [
    {
      selector:
        "ImportExpression[source.value=/^@\\/modules\\/[^/]+\\/(repositories|services|domain|dto|types|mappers|factories|validators|utils)\\//]",
      message: MODULE_PUBLIC_API_IMPORT_MESSAGE
    },
    {
      selector: "ImportExpression[source.value=/^@\\/lib\\/prisma/]",
      message: "Layer ini tidak boleh mengakses Prisma secara langsung."
    }
  ];
}

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".worktrees/**",
      ".claude/worktrees/**",
      "prisma/generated/**",
      "scripts/**",
      "temp_genieacs_source/**",
      ".next/**",
      "tmp/**",
      "out/**",
      "coverage/**",
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
    files: ["app/**/*.ts", "app/**/*.tsx"],
    ignores: ["app/api/**/*.ts", "app/api/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: createModuleBoundaryPatterns()
        }
      ],
      "no-restricted-syntax": ["error", ...createDynamicModuleBoundaryRules()]
    }
  },
  {
    files: ["app/api/**/*.ts", "app/api/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*/**", "!@/modules/*/api"],
              message: "API route wajib import module via public entrypoint (@/modules/<module>) atau sub-entrypoint publik yang disepakati."
            },
            {
              group: ["@/lib/prisma", "@/lib/prisma*"],
              message: "API route tidak boleh mengakses Prisma langsung; pindahkan ke service/repository."
            }
          ]
        }
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression[source.value=/^@\\/modules\\/[^/]+\\/.+/]",
          message: "API route wajib dynamic-import module via public entrypoint (@/modules/<module>)."
        },
        {
          selector: "ImportExpression[source.value=/^@\\/lib\\/prisma/]",
          message: "API route tidak boleh dynamic-import Prisma langsung; pindahkan ke service/repository."
        }
      ]
    }
  }
];

export default eslintConfig;
