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

/**
 * Buang baris komentar agar asersi menguji INSTRUKSI, bukan prosa.
 *
 * Perlu karena komentar di `Dockerfile` sengaja mengutip perintah yang
 * dilarang — lengkap dengan angka pengukurannya — supaya alasan pelarangan
 * ikut terbaca di tempat kejadian. Tanpa penyaringan ini, kutipan tersebut
 * membuat penjaga menyala terhadap dirinya sendiri.
 */
function stripComments(dockerfile: string): string {
  return dockerfile
    .split("\n")
    .filter((baris) => !baris.trimStart().startsWith("#"))
    .join("\n");
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
    const builderStage = getDockerfileStageBlock(dockerfile, "builder");
    const prodDepsStage = getDockerfileStageBlock(dockerfile, "prod-deps");

    expect(dockerfile).toContain("COPY package.json package-lock.json ./");
    expect(builderStage).toContain(
      "npm ci --legacy-peer-deps --no-audit --prefer-offline --ignore-scripts",
    );

    // prod-deps men-generate client Prisma sendiri, jadi skema dan config-nya
    // harus ada di stage itu — builder mendapatkannya lewat `COPY . .`.
    expect(prodDepsStage).toContain("COPY prisma ./prisma");
    expect(prodDepsStage).toContain("prisma.config.ts");
    expect(prodDepsStage).toContain("prisma.radius.config.ts");
    expect(prodDepsStage).toContain("prisma.billing.config.ts");
    expect(prodDepsStage).toContain("prisma.mitra.config.ts");

    expect(dockerfile).not.toContain("|| npm install");
  });

  it("tidak menyalin node_modules antar stage build", () => {
    const dockerfile = readProjectFile("Dockerfile");
    const builderStage = getDockerfileStageBlock(dockerfile, "builder");

    // Dulu ada stage `deps` yang hanya menjalankan `npm ci`, lalu builder
    // menyalinnya dengan `COPY --from=deps /app/node_modules`. Salinan itu
    // memindahkan ~1,8 GB dan memakan 115 detik tanpa manfaat: `npm ci` di
    // builder ter-cache oleh layer yang sama persis (package.json +
    // package-lock.json), dan tidak ada stage lain yang memakai `deps`.
    //
    // `node_modules` dari `prod-deps` ke `runner` TIDAK termasuk larangan ini:
    // itu satu-satunya cara node_modules produksi sampai ke image akhir.
    // `[\w-]+` bukan `\w+`: nama stage boleh mengandung tanda hubung
    // (`prod-deps`), dan versi pertama penjaga ini lolos justru karena itu.
    expect(builderStage).not.toMatch(/COPY --from=[\w-]+ \S*node_modules/);
    expect(dockerfile).not.toContain("AS deps");

    // Builder memasang dependensinya sendiri.
    expect(builderStage).toContain("COPY package.json package-lock.json ./");
    expect(builderStage).toContain("npm ci");
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
      "COPY --from=prod-deps /app/node_modules ./node_modules",
    );
    expect(runnerStage).not.toMatch(
      /COPY --from=builder \S*\s*\/app\/node_modules/,
    );
  });

  it("tidak pernah menulis ulang kepemilikan seluruh node_modules", () => {
    const dockerfile = readProjectFile("Dockerfile");
    const prodDepsStage = getDockerfileStageBlock(dockerfile, "prod-deps");
    const runnerStage = getDockerfileStageBlock(dockerfile, "runner");

    // Dua cara menulis ulang kepemilikan ratusan ribu berkas, dua-duanya sudah
    // diukur dan dua-duanya mahal:
    //
    //   `COPY --chown` di runner ................  773 detik (run #84)
    //   `RUN chown -R` di prod-deps ............. 4276 detik (run #88)
    //   `COPY` tanpa keduanya ...................   29,7 detik (run #88)
    //
    // `RUN chown -R` sempat dikira gratis karena `prod-deps` berjalan paralel
    // dengan kompilasi builder. Ternyata justru menjadi jalur kritis: webpack
    // selesai dalam 1608 detik, lalu build menunggu 44 menit lagi untuk chown.
    // `RUN` membuat layer baru, dan mengubah metadata tiap berkas memaksa
    // overlayfs menyalin-naik seluruh ~1,8 GB.
    //
    // Kepemilikan itu tidak dibutuhkan sama sekali: `npm ci` menulis mode
    // 644/755, jadi user `nextjs` bisa membaca dan menelusuri node_modules
    // milik root, dan tidak ada kode runtime yang menulis ke dalamnya.
    expect(stripComments(dockerfile)).not.toMatch(
      /chown -R \S+ \S*node_modules/,
    );
    expect(stripComments(runnerStage)).not.toContain(
      "--chown=nextjs:nodejs /app/node_modules",
    );

    // Perampingan tetap di prod-deps: itu memang murah dan membuat COPY
    // memindahkan lebih sedikit berkas.
    expect(prodDepsStage).toContain("node_modules trimmed successfully");
  });

  it("stamps the git revision into the image so a running pod can be traced back", () => {
    const dockerfile = readProjectFile("Dockerfile");

    expect(dockerfile).toContain('ARG IMAGE_REVISION="unknown"');
    expect(dockerfile).toContain(
      "LABEL org.opencontainers.image.revision=$IMAGE_REVISION",
    );
  });
});
