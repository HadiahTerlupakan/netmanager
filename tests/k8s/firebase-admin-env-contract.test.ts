import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readManifest(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("firebase admin env contract", () => {
  it("production app deployment wires firebase admin credentials from netmanager-secrets", () => {
    const yaml = readManifest("k8s/production/app-deployment.yaml");

    expect(yaml).toContain("- name: FIREBASE_PROJECT_ID");
    expect(yaml).toContain("key: FIREBASE_PROJECT_ID");
    expect(yaml).toContain("- name: FIREBASE_CLIENT_EMAIL");
    expect(yaml).toContain("key: FIREBASE_CLIENT_EMAIL");
    expect(yaml).toContain("- name: FIREBASE_PRIVATE_KEY");
    expect(yaml).toContain("key: FIREBASE_PRIVATE_KEY");
  });

  it("production app deployment keeps firebase realtime database env optional", () => {
    const yaml = readManifest("k8s/production/app-deployment.yaml");

    expect(yaml).toContain("- name: FIREBASE_DATABASE_URL");
    expect(yaml).toContain("key: FIREBASE_DATABASE_URL");
    expect(yaml).toContain("optional: true");
  });

  it("production secret template reserves firebase admin keys", () => {
    const yaml = readManifest("k8s/production/secrets.yaml");

    expect(yaml).toContain(
      'FIREBASE_PROJECT_ID: "REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY"',
    );
    expect(yaml).toContain(
      'FIREBASE_CLIENT_EMAIL: "REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY"',
    );
    expect(yaml).toContain(
      'FIREBASE_PRIVATE_KEY: "REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY"',
    );
    expect(yaml).toContain(
      'FIREBASE_DATABASE_URL: "REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY"',
    );
  });
});
