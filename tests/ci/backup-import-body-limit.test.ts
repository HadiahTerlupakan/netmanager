import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readProxyFile(): string {
  return readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
}

function readNextConfig(): string {
  return readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");
}

const BACKUP_IMPORT_ENDPOINT = "/api/settings/backup/import";

describe("backup import body limit", () => {
  it("raises Next proxy body limit above the default 10MB upload cutoff", () => {
    const nextConfig = readNextConfig();

    expect(nextConfig).toContain('proxyClientMaxBodySize: "1gb"');
    expect(nextConfig).not.toContain("middlewareClientMaxBodySize");
  });

  it("bypasses proxy for backup import endpoint to avoid body cloning limit", () => {
    const proxyContent = readProxyFile();

    // Verify backup import endpoint is explicitly bypassed
    expect(proxyContent).toContain(BACKUP_IMPORT_ENDPOINT);

    // Verify bypass happens early in file (before line 100, in the API bypass section)
    const lines = proxyContent.split("\n");
    const bypassLineIndex = lines.findIndex((line) =>
      line.includes(BACKUP_IMPORT_ENDPOINT),
    );

    expect(bypassLineIndex).toBeGreaterThan(-1);
    expect(bypassLineIndex).toBeLessThan(100); // Early return section is within first 100 lines
  });
});
