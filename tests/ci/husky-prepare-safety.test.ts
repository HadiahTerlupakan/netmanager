import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { shouldInstallHusky } from "../../scripts/run-husky-prepare.js";

function readPackageJson(): {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  overrides?: Record<string, string>;
} {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  );
}

function readHuskyPrepareScript(): string {
  return readFileSync(
    resolve(process.cwd(), "scripts", "run-husky-prepare.js"),
    "utf8",
  );
}

function readHuskyPreCommitHook(): string {
  return readFileSync(resolve(process.cwd(), ".husky", "pre-commit"), "utf8");
}

describe("Husky prepare safety", () => {
  it("pins hono to a patched release that closes current production advisories", () => {
    const packageJson = readPackageJson();

    expect(packageJson.dependencies?.hono).toBe("^4.12.14");
    expect(packageJson.overrides?.hono).toBe("^4.12.14");
  });

  it("resolves direct execution against the real script file URL", () => {
    const script = readHuskyPrepareScript();

    expect(script).toContain("pathToFileURL(resolve(entrypoint)).href");
  });

  it("keeps the generated Husky pre-commit hook intact", () => {
    expect(readHuskyPreCommitHook()).toContain("npx lint-staged");
  });

  it("uses Husky's supported entrypoint instead of husky/bin.js", () => {
    const script = readHuskyPrepareScript();

    expect(script).not.toContain("husky/bin.js");
  });

  it("regenerates Prisma clients after dependency installation", () => {
    const packageJson = readPackageJson();

    expect(packageJson.scripts?.postinstall).toBe("npm run prisma:generate");
  });

  it("routes prepare through a repo-controlled wrapper script", () => {
    const packageJson = readPackageJson();

    expect(packageJson.scripts?.prepare).toBe(
      "node scripts/run-husky-prepare.js",
    );
    expect(
      existsSync(resolve(process.cwd(), "scripts", "run-husky-prepare.js")),
    ).toBe(true);
  });

  it("skips Husky installation in CI", () => {
    expect(
      shouldInstallHusky({
        env: { CI: "true" },
        gitDirectoryExists: true,
        gitCommandExists: true,
      }),
    ).toBe(false);
  });

  it("skips Husky installation when HUSKY=0", () => {
    expect(
      shouldInstallHusky({
        env: { HUSKY: "0" },
        gitDirectoryExists: true,
        gitCommandExists: true,
      }),
    ).toBe(false);
  });

  it("skips Husky installation when the git directory is missing", () => {
    expect(
      shouldInstallHusky({
        env: {},
        gitDirectoryExists: false,
        gitCommandExists: true,
      }),
    ).toBe(false);
  });

  it("skips Husky installation when git is unavailable", () => {
    expect(
      shouldInstallHusky({
        env: {},
        gitDirectoryExists: true,
        gitCommandExists: false,
      }),
    ).toBe(false);
  });

  it("allows Husky installation for a local git checkout", () => {
    expect(
      shouldInstallHusky({
        env: {},
        gitDirectoryExists: true,
        gitCommandExists: true,
      }),
    ).toBe(true);
  });
});
