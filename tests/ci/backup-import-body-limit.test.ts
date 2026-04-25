import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readNextConfig(): string {
  return readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");
}

describe("backup import body limit", () => {
  it("raises Next proxy body limit above the default 10MB upload cutoff", () => {
    const nextConfig = readNextConfig();

    expect(nextConfig).toContain('proxyClientMaxBodySize: "1gb"');
    expect(nextConfig).not.toContain("middlewareClientMaxBodySize");
  });
});
