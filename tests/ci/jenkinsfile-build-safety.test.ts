import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readJenkinsfile(): string {
  return readFileSync(resolve(process.cwd(), "Jenkinsfile"), "utf8");
}

function readDockerfile(): string {
  return readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");
}

describe("Jenkinsfile and Dockerfile build safety", () => {
  it("uses deterministic npm ci without npm install fallback in CI/build paths", () => {
    const jenkinsfile = readJenkinsfile();
    const dockerfile = readDockerfile();

    expect(jenkinsfile).toContain("npm ci --no-audit --prefer-offline");
    expect(jenkinsfile).not.toContain("|| npm install");

    expect(dockerfile).toContain("COPY package.json package-lock.json ./");
    expect(dockerfile).toContain(
      "COPY scripts/run-husky-prepare.js ./scripts/run-husky-prepare.js",
    );
    expect(dockerfile).toContain(
      "npm ci --legacy-peer-deps --no-audit --prefer-offline",
    );
    expect(dockerfile).not.toContain("|| npm install");
  });

  it("enforces pipefail for backup and image loading checks", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain("set -euo pipefail");
    expect(jenkinsfile).toMatch(/grep -F .*DOCKER_IMAGE.*DOCKER_TAG/);
    expect(jenkinsfile).toMatch(/grep -F .*CRON_IMAGE.*DOCKER_TAG/);
    expect(jenkinsfile).toMatch(/grep -F .*RADIUS_IMAGE.*DOCKER_TAG/);
    expect(jenkinsfile).not.toContain("grep netmanager || true");
  });

  it("verifies imported k3s images without shell command substitution escaping the helper container", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain(
      'sh -c "chroot /host /usr/local/bin/k3s ctr images list" > .k3s-images.txt',
    );
    expect(jenkinsfile).toContain(
      'grep -F "${DOCKER_IMAGE}:${DOCKER_TAG}" .k3s-images.txt',
    );
    expect(jenkinsfile).toContain(
      'grep -F "${CRON_IMAGE}:${DOCKER_TAG}" .k3s-images.txt',
    );
    expect(jenkinsfile).toContain(
      'grep -F "${RADIUS_IMAGE}:${DOCKER_TAG}" .k3s-images.txt',
    );
    expect(jenkinsfile).not.toContain(
      "IMAGES=\\$(chroot /host /usr/local/bin/k3s ctr images list)",
    );
  });

  it("fails production migration by default when backup fails unless explicit override is set", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain("ALLOW_MIGRATION_WITHOUT_BACKUP");
    expect(jenkinsfile).toContain(
      "Pre-migration backup failed; aborting production migration",
    );
  });
});
