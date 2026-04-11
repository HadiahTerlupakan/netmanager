import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readNextConfig(): string {
  return readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");
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
});
