import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readProxyFile(): string {
  return readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
}

function readNextConfig(): string {
  return readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");
}

describe("backup import body limit", () => {
  it("raises Next proxy body limit above the default 10MB upload cutoff", () => {
    const nextConfig = readNextConfig();

    expect(nextConfig).toContain('proxyClientMaxBodySize: "1gb"');
    expect(nextConfig).not.toContain("middlewareClientMaxBodySize");
  });

  it("bypasses proxy for backup import endpoint to avoid body cloning limit", () => {
    const proxyContent = readProxyFile();

    // Verify backup import endpoint is explicitly bypassed
    expect(proxyContent).toContain("/api/settings/backup/import");

    // Verify bypass happens in the early return section (before proxy logic)
    const apiBypassSection = proxyContent.match(
      /if\s*\(\s*pathname\.startsWith\("\/api"\)[\s\S]*?\)/,
    );

    expect(apiBypassSection).toBeTruthy();
    expect(apiBypassSection![0]).toContain("/api/settings/backup/import");
  });
});
