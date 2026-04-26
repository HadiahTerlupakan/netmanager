import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readSourceFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function extractClassNameValue(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error(`Marker not found: ${marker}`);
  }

  const classNameMatch = source
    .slice(markerIndex)
    .match(/className=\{?(["'`])([\s\S]*?)\1\}?/);

  if (!classNameMatch) {
    throw new Error(`Quoted className not found after marker: ${marker}`);
  }

  return classNameMatch[2];
}

function extractTokenValue(className: string, prefix: string): string {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = className.match(new RegExp(`${escapedPrefix}(\\d+)`));

  if (!match) {
    throw new Error(`Token not found for prefix: ${prefix}`);
  }

  return match[1];
}

describe("admin layout sidebar offset", () => {
  it("keeps the admin content offset aligned with the fixed sidebar width", () => {
    const adminLayout = readSourceFile("app/admin/layout.tsx");
    const sidebar = readSourceFile("components/layout/Sidebar.tsx");
    const sidebarClassName = extractClassNameValue(sidebar, "<aside");
    const adminContentClassName = extractClassNameValue(
      adminLayout,
      '<div className="flex-1 flex flex-col',
    );
    const sidebarWidthToken = extractTokenValue(sidebarClassName, "w-");
    const adminOffsetToken = extractTokenValue(adminContentClassName, "md:pl-");

    expect(sidebarClassName).toContain("fixed");
    expect(sidebarClassName).toContain("w-72");
    expect(sidebarClassName).not.toContain("md:sticky");
    expect(adminContentClassName).toContain("md:pl-72");
    expect(sidebarWidthToken).toBe(adminOffsetToken);
  });
});
