import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readManifest(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("postgres probe database safety", () => {
  it("production postgres probes target the declared database for each statefulset", () => {
    const yaml = readManifest("k8s/production/db-statefulset.yaml");

    expect(yaml).toContain(
      'command: ["pg_isready", "-U", "netmgr", "-d", "netmanager"]',
    );
    expect(yaml).toContain(
      'command: ["pg_isready", "-U", "netmgr", "-d", "billing"]',
    );
    expect(yaml).toContain(
      'command: ["pg_isready", "-U", "netmgr", "-d", "mitra"]',
    );
    expect(yaml).toContain(
      'command: ["pg_isready", "-U", "netmgr", "-d", "radius"]',
    );
    expect(yaml).not.toContain('command: ["pg_isready", "-U", "netmgr"]');
  });
});
