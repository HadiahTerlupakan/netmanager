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

  it("excludes backup import endpoint from proxy matcher to avoid body cloning", () => {
    const proxyContent = readProxyFile();

    // Verify matcher config exists
    const matcherConfig = proxyContent.match(
      /matcher:\s*\[[\s\S]*?"(.+?)"[\s\S]*?\]/,
    );
    expect(matcherConfig).toBeTruthy();

    const matcherPattern = matcherConfig![1];

    // Verify endpoint is in negative lookahead (excluded from matching)
    // Pattern should be: /((?!...excluded-paths...).*)/
    expect(matcherPattern).toMatch(/\(\?\!/); // Has negative lookahead
    expect(matcherPattern).toContain("api/settings/backup/import"); // Endpoint is in the exclusion list

    // Verify the exclusion is in the negative lookahead group
    const negativeLookahead = matcherPattern.match(/\(\?\!([^)]+)\)/);
    expect(negativeLookahead).toBeTruthy();
    expect(negativeLookahead![1]).toContain("api/settings/backup/import");
  });
});
