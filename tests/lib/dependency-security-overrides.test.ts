import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

function readInstalledVersion(packageName: string): string {
  const manifestPath = path.join(
    process.cwd(),
    "node_modules",
    packageName,
    "package.json",
  );
  return JSON.parse(readFileSync(manifestPath, "utf8")).version;
}

function parseVersion(version: string): number[] {
  return version
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10));
}

function isAtLeast(version: string, minimum: string): boolean {
  const actual = parseVersion(version);
  const required = parseVersion(minimum);
  for (let index = 0; index < required.length; index++) {
    const difference = (actual[index] ?? 0) - required[index];
    if (difference !== 0) return difference > 0;
  }
  return true;
}

// Override di package.json yang menutup alert Dependabot. Tes ini menjaga
// agar tidak ada yang diam-diam kembali ke versi rentan saat lockfile dibuat ulang.
describe("override keamanan dependensi", () => {
  it.each([
    ["follow-redirects", "1.16.2"], // GHSA-mrwp-f3q8-3g9p
    ["glob", "14.0.2"], // GHSA-3g3m-2fjr-6pw4
    ["minimatch", "11.0.1"], // GHSA-g3hv-75wg-m249 (salinan yang dipakai glob & typescript-estree)
  ])("%s terpasang minimal %s", (packageName, minimum) => {
    expect(isAtLeast(readInstalledVersion(packageName), minimum)).toBe(true);
  });

  it("glob 14 tetap menyediakan API yang dipakai swagger-jsdoc dan archiver-utils", () => {
    const glob = require("glob");

    expect(typeof glob.sync).toBe("function");
    expect(typeof glob.globSync).toBe("function");
    expect(typeof glob.hasMagic).toBe("function");
    expect(
      glob.sync("app/api/docs/*.ts", { cwd: process.cwd(), nodir: true }),
    ).toContain("app/api/docs/route.ts");
  });
});

// deepmerge 4.3.1 belum punya rilis perbaikan untuk GHSA-gcqx-w48m-w2h4,
// jadi dipakai salinan lokal shims/deepmerge dengan penjaga __proto__.
describe("shim deepmerge", () => {
  const deepmerge = require("deepmerge");
  const poisoned = JSON.parse('{"__proto__":{"isAdmin":true},"a":{"b":2}}');

  it("memakai shim lokal, bukan paket rentan dari registry", () => {
    expect(readInstalledVersion("deepmerge")).toBe("4.3.1-radpro.1");
  });

  it("tidak mengganti prototype hasil merge dari source", () => {
    const merged = deepmerge({ a: { c: 1 } }, poisoned);

    expect(merged.isAdmin).toBeUndefined();
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(merged).toEqual({ a: { c: 1, b: 2 } });
  });

  it("tidak mengganti prototype hasil merge dari target", () => {
    const merged = deepmerge(poisoned, { x: 1 });

    expect(merged.isAdmin).toBeUndefined();
    expect(merged).toEqual({ a: { b: 2 }, x: 1 });
  });

  it("merge biasa dan deepmerge.all tetap bekerja seperti 4.3.1", () => {
    expect(
      deepmerge({ list: [1] }, { list: [2], nested: { on: true } }),
    ).toEqual({ list: [1, 2], nested: { on: true } });
    expect(deepmerge.all([{ a: 1 }, { b: 2 }, { a: 3 }])).toEqual({
      a: 3,
      b: 2,
    });
  });
});
