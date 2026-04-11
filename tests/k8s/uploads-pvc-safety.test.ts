import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readManifest(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("staging uploads PVC safety", () => {
  it("runs a single app replica while uploads persistence remains ReadWriteOnce", () => {
    const appYaml = readManifest("k8s/staging/app-deployment.yaml");
    const pvcYaml = readManifest("k8s/staging/pvc.yaml");

    expect(pvcYaml).toContain("name: netmanager-uploads");
    expect(pvcYaml).toContain("ReadWriteOnce");
    expect(appYaml).toContain("claimName: netmanager-uploads");
    expect(appYaml).toContain("replicas: 1");
    expect(appYaml).not.toContain("replicas: 2");
  });
});
