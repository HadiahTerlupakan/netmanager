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

  it("excludes backup import endpoint from proxy matcher to avoid body cloning", () => {
    const proxyContent = readProxyFile();

    // Verify exclusion is in matcher config (not in conditional logic)
    const matcherConfig = proxyContent.match(/matcher:\s*\[["'](.+?)["']\]/);
    expect(matcherConfig).toBeTruthy();
    expect(matcherConfig![1]).toContain("api/settings/backup/import");
  });
});
