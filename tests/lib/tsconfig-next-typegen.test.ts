import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("typecheck configuration", () => {
  it("uses dedicated tsconfig that excludes unstable dev type artifacts", () => {
    const root = process.cwd();
    const packageJson = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.typecheck).toBe(
      "next typegen && tsc --noEmit -p tsconfig.typecheck.json",
    );
    expect(existsSync(path.join(root, "tsconfig.typecheck.json"))).toBe(true);

    const tsconfig = JSON.parse(
      readFileSync(path.join(root, "tsconfig.typecheck.json"), "utf8"),
    ) as {
      include?: string[];
      exclude?: string[];
    };

    expect(tsconfig.include).toEqual([
      "next-env.d.ts",
      "**/*.ts",
      "**/*.tsx",
      ".next/types/**/*.ts",
    ]);
    expect(tsconfig.exclude).toEqual([
      "node_modules",
      "mobile",
      "tmp",
      ".next/dev/types",
    ]);
  });
});
