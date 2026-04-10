import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readManifest(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("app deployment cron configuration", () => {
  it("production app deployment disables internal cron", () => {
    const yaml = readManifest("k8s/production/app-deployment.yaml");

    expect(yaml).toContain("- name: ENABLE_INTERNAL_CRON");
    expect(yaml).toContain('value: "false"');
  });

  it("production cron deployment checks the crond process", () => {
    const yaml = readManifest("k8s/production/cron-deployment.yaml");

    expect(yaml).toContain('command: ["pgrep", "-f", "crond"]');
    expect(yaml).not.toContain('command: ["pgrep", "-f", "node"]');
  });

  it("staging app deployment disables internal cron", () => {
    const yaml = readManifest("k8s/staging/app-deployment.yaml");

    expect(yaml).toContain("- name: ENABLE_INTERNAL_CRON");
    expect(yaml).toContain('value: "false"');
  });

  it("staging cron deployment checks the crond process", () => {
    const yaml = readManifest("k8s/staging/cron-deployment.yaml");

    expect(yaml).toContain('command: ["pgrep", "-f", "crond"]');
    expect(yaml).not.toContain('command: ["pgrep", "-f", "node"]');
  });
});
