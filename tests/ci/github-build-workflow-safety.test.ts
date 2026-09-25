import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Workflow GitHub hanya menjalankan quality dan membangun image. Akses ke
 * produksi (kunci SSH, kubectl, secret runtime) harus tetap terkurung di
 * workflow deploy Gitea, supaya akun GitHub yang bocor hanya bisa membuat
 * image — tidak bisa menyentuh server produksi.
 */

const WORKFLOW = ".github/workflows/build-image.yml";

function readWorkflow(): string {
  return readFileSync(resolve(process.cwd(), WORKFLOW), "utf8");
}

/** Blok satu job: dari header `  <nama>:` sampai header job berikutnya. */
function readJobBlock(jobName: string): string {
  const workflow = readWorkflow();
  const start = workflow.indexOf(`\n  ${jobName}:\n`);
  if (start < 0) throw new Error(`Job ${jobName} tidak ditemukan`);
  const rest = workflow.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][\w-]*:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

describe("workflow build GitHub", () => {
  it("tidak memegang akses apa pun ke produksi", () => {
    // Komentar boleh menjelaskan kubectl/SSH; yang diperiksa hanya isi kerja.
    const workflow = readWorkflow()
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");

    expect(workflow).not.toMatch(/secrets\.DEPLOY_/);
    expect(workflow).not.toContain("kubectl");
    expect(workflow).not.toMatch(/\bssh\b/);
    // Satu-satunya secret yang boleh dipakai adalah token bawaan GitHub.
    const secretNames = [...workflow.matchAll(/secrets\.([A-Z_]+)/g)].map(
      (match) => match[1],
    );
    expect(new Set(secretNames)).toEqual(new Set(["GITHUB_TOKEN"]));
  });

  it("izin bawaan hanya baca; hak tulis package hanya untuk job build", () => {
    const workflow = readWorkflow();

    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(readJobBlock("quality")).not.toContain("packages: write");
    expect(readJobBlock("build")).toContain("packages: write");
  });

  it("image hanya dibangun setelah quality lulus", () => {
    expect(readJobBlock("build")).toMatch(/^ {4}needs: quality$/m);
  });

  it("tidak dipicu event yang membawa kode dari luar", () => {
    const workflow = readWorkflow();

    expect(workflow).not.toContain("pull_request");
    expect(workflow).not.toContain("repository_dispatch");
  });

  it("tag image bisa dihitung ulang job deploy dari commit yang sama", () => {
    expect(readJobBlock("build")).toContain(
      'VERSION="$(echo "${GITHUB_SHA}" | cut -c1-12)-$(git show -s --format=%ct HEAD)"',
    );
  });

  it("build aplikasi memakai secret dummy dan melewati typecheck ganda", () => {
    const build = readJobBlock("build");

    expect(build).toContain(
      "NEXTAUTH_SECRET=ci-build-dummy-secret-at-least-32-chars",
    );
    expect(build).toContain("SKIP_TS_CHECK=true");
    expect(build).toContain("IMAGE_REVISION=${{ github.sha }}");
  });

  it("memindai secret pada commit yang didorong sebelum apa pun dipasang", () => {
    const quality = readJobBlock("quality");
    const pindai = quality.indexOf("zricethezav/gitleaks:");

    expect(pindai).toBeGreaterThan(-1);
    expect(quality).toContain("fetch-depth: 0");
    expect(quality).toContain('--log-opts="${RENTANG}"');
    expect(pindai).toBeLessThan(quality.indexOf("npm ci"));
  });

  it("quality menjalankan lint, typecheck, dan tes seperti pipeline Gitea", () => {
    const quality = readJobBlock("quality");

    expect(quality).toContain("npm ci --no-audit --prefer-offline");
    expect(quality).toContain("npm run prisma:generate");
    expect(quality).toContain("npm run lint");
    expect(quality).toContain("npm run typecheck");
    expect(quality).toContain("npx vitest run");
  });
});
