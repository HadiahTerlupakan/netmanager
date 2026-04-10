import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { shouldInstallHusky } from "../../scripts/run-husky-prepare.js";

function readPackageJson(): { scripts?: Record<string, string> } {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  );
}

describe("Husky prepare safety", () => {
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
