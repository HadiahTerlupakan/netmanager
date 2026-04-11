import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readJenkinsfile(): string {
  return readFileSync(resolve(process.cwd(), "Jenkinsfile"), "utf8");
}

function readDockerfile(): string {
  return readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");
}

function getDockerfileStageBlock(
  dockerfile: string,
  stageName: string,
): string {
  const stageStart = dockerfile.indexOf(`FROM node:24-alpine AS ${stageName}`);

  if (stageStart === -1) {
    return "";
  }

  const nextStageStart = dockerfile.indexOf(
    "FROM node:24-alpine AS ",
    stageStart + 1,
  );

  return nextStageStart === -1
    ? dockerfile.slice(stageStart)
    : dockerfile.slice(stageStart, nextStageStart);
}

describe("Jenkinsfile and Dockerfile build safety", () => {
  it("uses deterministic npm ci without npm install fallback in CI/build paths", () => {
    const jenkinsfile = readJenkinsfile();
    const dockerfile = readDockerfile();
    const depsStage = getDockerfileStageBlock(dockerfile, "deps");

    expect(jenkinsfile).toContain("npm ci --no-audit --prefer-offline");
    expect(jenkinsfile).not.toContain("|| npm install");

    expect(dockerfile).toContain("COPY package.json package-lock.json ./");
    expect(dockerfile).toContain(
      "COPY scripts/run-husky-prepare.js ./scripts/run-husky-prepare.js",
    );
    expect(depsStage).toContain("COPY prisma ./prisma");
    expect(depsStage).toContain("prisma.config.ts");
    expect(depsStage).toContain("prisma.radius.config.ts");
    expect(depsStage).toContain("prisma.billing.config.ts");
    expect(depsStage).toContain("prisma.mitra.config.ts");
    expect(dockerfile).toContain(
      "npm ci --legacy-peer-deps --no-audit --prefer-offline --ignore-scripts",
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

  it("copies Prisma schema inputs and runs prisma generate after the app source copy in the builder stage", () => {
    const dockerfile = readDockerfile();
    const builderStage = getDockerfileStageBlock(dockerfile, "builder");
    const appCopyIndex = builderStage.indexOf("COPY . .");
    const prismaGenerateIndex = builderStage.indexOf(
      "RUN npm run prisma:generate",
    );

    expect(builderStage).toContain("FROM node:24-alpine AS builder");
    expect(builderStage).toContain(
      "COPY --from=deps /app/node_modules ./node_modules",
    );

    expect(appCopyIndex).toBeGreaterThan(-1);
    expect(prismaGenerateIndex).toBeGreaterThan(-1);
    expect(appCopyIndex).toBeLessThan(prismaGenerateIndex);
  });

  it("fails production migration by default when backup fails unless explicit override is set", () => {
    const jenkinsfile = readJenkinsfile();

    expect(jenkinsfile).toContain("ALLOW_MIGRATION_WITHOUT_BACKUP");
    expect(jenkinsfile).toContain(
      "Pre-migration backup failed; aborting production migration",
    );
  });
});
