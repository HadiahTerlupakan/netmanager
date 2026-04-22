import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import fg from "fast-glob";
import { describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDirectory, "..", "..");

type DependencyMap = Record<string, string>;

type PackageJsonShape = {
  overrides?: DependencyMap;
};

type PackageLockShape = {
  packages?: Record<string, { version?: string }>;
};

function readNextConfig(): string {
  return readFileSync(resolve(projectRoot, "next.config.ts"), "utf8");
}

function getPublicAttendanceMatches(patterns: string[]): string[] {
  return fg
    .sync(patterns, {
      cwd: resolve(projectRoot, "public"),
    })
    .filter((entry) => entry.includes("uploads/attendance/"));
}

function readPackageJson(): PackageJsonShape {
  const packageJsonPath = resolve(projectRoot, "package.json");
  const packageJsonContent = readFileSync(packageJsonPath, "utf8");

  return JSON.parse(packageJsonContent) as PackageJsonShape;
}

function readPackageLock(): PackageLockShape {
  const packageLockPath = resolve(projectRoot, "package-lock.json");
  const packageLockContent = readFileSync(packageLockPath, "utf8");

  return JSON.parse(packageLockContent) as PackageLockShape;
}

describe("PWA precache safety", () => {
  it("filters runtime Next.js manifest URLs from the final precache manifest", () => {
    const nextConfig = readNextConfig();

    expect(nextConfig).toContain("workboxOptions");
    expect(nextConfig).toContain("manifestTransforms");
    expect(nextConfig).toContain("entry.url");
    expect(nextConfig).toContain("/_next/build-manifest.json");
    expect(nextConfig).toContain("/_next/react-loadable-manifest.json");
    expect(nextConfig).toContain("/_next/server/middleware-build-manifest.js");
    expect(nextConfig).toContain(
      "/_next/server/middleware-react-loadable-manifest.js",
    );
    expect(nextConfig).toContain("/_next/server/next-font-manifest.js");
    expect(nextConfig).toContain("/_next/server/next-font-manifest.json");
  });

  it("excludes public uploads attendance assets from precache", () => {
    const nextConfig = readNextConfig();
    const includedAttendanceAssets = getPublicAttendanceMatches([
      "**/*",
      "uploads/**",
    ]);
    const excludedAttendanceAssets = getPublicAttendanceMatches([
      "**/*",
      "!uploads/**",
    ]);

    expect(includedAttendanceAssets.length).toBeGreaterThan(0);
    expect(excludedAttendanceAssets).toEqual([]);
    expect(nextConfig).toContain("publicExcludes");
    expect(nextConfig).toContain('"!uploads/**"');
  });

  it("pins patched serialize-javascript for next-pwa workbox chain", () => {
    const packageJson = readPackageJson();
    const packageLock = readPackageLock();
    const overrides = packageJson.overrides ?? {};
    const packages = packageLock.packages ?? {};

    expect(overrides["serialize-javascript"]).toBe("^7.0.5");
    expect(packages["node_modules/@rollup/plugin-terser"]?.version).toBe(
      "0.4.4",
    );
    expect(packages["node_modules/serialize-javascript"]?.version).toBe(
      "7.0.5",
    );
  });
});
