import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Jaminan tentang cara image dibangun — bukan tentang pipeline yang memanggil
 * build-nya. Semuanya dulu bercampur dengan asersi Jenkinsfile di
 * `tests/ci/jenkinsfile-build-safety.test.ts`; ketika `Jenkinsfile` dihapus,
 * bagian ini dipindah ke sini agar tidak ikut terbuang.
 */

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function readPackageJson(): { scripts: Record<string, string> } {
  return JSON.parse(readProjectFile("package.json")) as {
    scripts: Record<string, string>;
  };
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

describe("docker image build safety", () => {
  it("installs dependencies deterministically without an npm install fallback", () => {
    const dockerfile = readProjectFile("Dockerfile");
    const depsStage = getDockerfileStageBlock(dockerfile, "deps");

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

  it("keeps transient working directories out of the build context", () => {
    const dockerignore = readProjectFile(".dockerignore");

    expect(dockerignore).toContain("tmp/");
    expect(dockerignore).toContain(".worktrees/");
    expect(dockerignore).toContain(".claude/");
  });

  it("generates the Prisma client for both the compile and runtime node_modules", () => {
    const dockerfile = readProjectFile("Dockerfile");
    const packageJson = readPackageJson();
    const builderStage = getDockerfileStageBlock(dockerfile, "builder");
    const prodDepsStage = getDockerfileStageBlock(dockerfile, "prod-deps");
    const runnerStage = getDockerfileStageBlock(dockerfile, "runner");
    const prismaGenerateMatches =
      dockerfile.match(/RUN npm run prisma:generate/g) ?? [];
    const npmCiMatches =
      dockerfile.match(
        /npm ci --legacy-peer-deps --no-audit --prefer-offline --ignore-scripts/g,
      ) ?? [];

    expect(packageJson.scripts.postinstall).toBe("npm run prisma:generate");
    expect(builderStage).toContain("FROM node:24-alpine AS builder");
    expect(builderStage).toContain(
      "COPY --from=deps /app/node_modules ./node_modules",
    );
    expect(builderStage).toContain("COPY . .");
    // Dua generate yang disengaja: builder butuh client saat mengompilasi, dan
    // prod-deps menyiapkan client untuk node_modules yang dipakai runtime.
    // Dulu hanya ada satu karena runner memakai node_modules bekas builder yang
    // dipangkas `npm prune`; pemangkasan itu diganti pemasangan bersih karena
    // memakan 9,6 menit dari 31 menit build.
    expect(prismaGenerateMatches).toHaveLength(2);
    expect(npmCiMatches).toHaveLength(1);

    // Client Prisma harus ada di image runtime. Dulu dijamin dengan memastikan
    // generate terjadi sebelum prune; sekarang dijamin karena prod-deps
    // men-generate sendiri dan runner menyalin node_modules dari sana.
    expect(dockerfile).not.toContain("RUN npm prune");
    expect(prodDepsStage).toContain("npm ci --omit=dev");
    expect(prodDepsStage).toContain("RUN npm run prisma:generate");
    expect(runnerStage).toContain(
      "COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules",
    );
    expect(runnerStage).not.toContain(
      "COPY --from=builder --chown=nextjs:nodejs /app/node_modules",
    );
  });

  it("stamps the git revision into the image so a running pod can be traced back", () => {
    const dockerfile = readProjectFile("Dockerfile");

    expect(dockerfile).toContain('ARG IMAGE_REVISION="unknown"');
    expect(dockerfile).toContain(
      "LABEL org.opencontainers.image.revision=$IMAGE_REVISION",
    );
  });
});
