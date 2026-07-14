import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readManifest(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("redis deployment safety", () => {
  it("production redis uses noeviction for BullMQ workloads", () => {
    const yaml = readManifest("k8s/production/redis-deployment.yaml");

    expect(yaml).toContain('"--maxmemory-policy", "noeviction"');
    expect(yaml).not.toContain('"--maxmemory-policy", "allkeys-lru"');
  });
});
