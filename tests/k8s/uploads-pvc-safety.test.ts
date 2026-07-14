import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readManifest(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("production uploads PVC safety", () => {
  it("runs a single app replica while uploads persistence remains ReadWriteOnce", () => {
    const appYaml = readManifest("k8s/production/app-deployment.yaml");
    const pvcYaml = readManifest("k8s/production/pvc.yaml");

    expect(pvcYaml).toContain("name: netmanager-uploads");
    expect(pvcYaml).toContain("ReadWriteOnce");
    expect(appYaml).toContain("claimName: netmanager-uploads");
  });
});
