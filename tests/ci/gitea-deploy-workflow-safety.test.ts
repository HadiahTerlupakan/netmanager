import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Jaminan pipeline yang dulu dijaga terhadap `Jenkinsfile`. Ketika CI/CD
 * pindah ke Gitea Actions, subjeknya berganti tetapi risikonya tidak: image
 * yang tidak pernah terdorong, template placeholder yang ikut ter-apply, dan
 * manifes yang masih menyimpan placeholder semuanya berakhir sebagai deploy
 * yang hijau di pipeline tetapi mati di cluster.
 */

function readWorkflow(): string {
  return readFileSync(
    resolve(process.cwd(), ".gitea/workflows/deploy-production.yml"),
    "utf8",
  );
}

/** Quality dan build image kini berjalan di workflow GitHub ini. */
function readBuildWorkflow(): string {
  return readFileSync(
    resolve(process.cwd(), ".github/workflows/build-image.yml"),
    "utf8",
  );
}

/** Daftar pola `paths-ignore` pemicu push sebuah workflow. */
function readPathsIgnore(workflow: string): string[] {
  const pola: string[] = [];
  const baris = workflow.split("paths-ignore:\n")[1]?.split("\n") ?? [];
  for (const isi of baris) {
    const cocok = isi.match(/^\s+- "([^"]+)"$/);
    if (cocok) {
      pola.push(cocok[1]);
      continue;
    }
    // Komentar di dalam daftar dilewati; baris lain berarti daftarnya habis.
    if (!/^\s+#/.test(isi)) break;
  }
  return pola;
}

describe("Gitea production workflow safety", () => {
  it("stops waiting the moment the migration job fails instead of hanging until the timeout", () => {
    // `kubectl wait --for=condition=complete` tidak pernah kembali saat Job
    // gagal: kondisi Complete tidak akan pernah True. Pada 2026-09-18 guard
    // menolak migrasi destruktif dalam hitungan detik, tetapi pipeline tetap
    // menggantung 40+ menit menunggu batas 3900s — antrean deploy ikut macet.
    const workflow = readWorkflow();

    expect(workflow).toContain(
      '{.status.conditions[?(@.type=="Complete")].status}',
    );
    expect(workflow).toContain(
      '{.status.conditions[?(@.type=="Failed")].status}',
    );
    expect(workflow).not.toContain("wait --for=condition=complete");
  });

  it("installs dependencies deterministically without an npm install fallback", () => {
    const workflow = readBuildWorkflow();

    expect(workflow).toContain("npm ci --no-audit --prefer-offline");
    expect(workflow).not.toContain("npm install");
  });

  it("generates the Prisma client explicitly after install, not as a postinstall side effect", () => {
    // `--ignore-scripts` mematikan postinstall, jadi generate harus dipanggil
    // sendiri. Versi paralelnya sengaja tidak dipakai: puncak pemakaian RAM-nya
    // menjatuhkan job.
    const workflow = readBuildWorkflow();
    const indeksInstall = workflow.indexOf(
      "npm ci --no-audit --prefer-offline --ignore-scripts",
    );
    const indeksGenerate = workflow.indexOf("npm run prisma:generate");

    expect(indeksInstall).toBeGreaterThan(-1);
    expect(indeksGenerate).toBeGreaterThan(indeksInstall);
    expect(workflow).not.toContain("prisma:generate-parallel");
  });

  it("only deploys images that were pushed to the official registry first", () => {
    const workflow = readWorkflow();

    // Referensi image disusun dari secret registry, bukan dari nama bebas,
    // sehingga tidak ada jalan menerapkan image di luar registri resmi.
    expect(workflow).toContain(
      'BASE="${{ secrets.REGISTRY_URL }}/${{ secrets.REGISTRY_NAMESPACE }}"',
    );
    expect(workflow).toContain("docker login");

    // Gitea tidak membangun apa pun: deploy menunggu ketiga image yang
    // didorong GitHub Actions setelah quality dan tes lulus.
    expect(workflow).not.toMatch(/docker (build|push) /);
    expect(workflow).toContain('until docker manifest inspect "${IMAGE}"');
    for (const output of ["app_image", "cron_image", "radius_image"]) {
      expect(workflow).toContain(`"\${{ steps.refs.outputs.${output} }}"`);
    }
    expect(workflow).toMatch(/deploy:\s*\n\s+needs: image/);
  });

  it("stops waiting as soon as the GitHub build for the commit has failed", () => {
    // Run #78 (2026-09-25) menunggu 60 menit penuh untuk image dari build
    // GitHub yang sudah gagal, dan menahan antrean deploy selama itu.
    const workflow = readWorkflow();

    expect(workflow).toContain("status_build_github()");
    expect(workflow).toContain(
      "actions/workflows/${alur}/runs?head_sha=${sha}",
    );
    expect(workflow).toContain(
      'runs.every((run) => run.status === "completed")',
    );
    expect(workflow).toContain(
      'runs.some((run) => run.conclusion === "success")',
    );
    // Workflow yang ditanya harus workflow build yang sungguhan ada.
    expect(workflow).toContain("GITHUB_WORKFLOW_BUILD: build-image.yml");
    expect(readBuildWorkflow()).toContain("name: Quality & Build Image");
  });

  it("computes the same image tag as the GitHub build workflow", () => {
    // Rumus berbeda berarti deploy menunggu tag yang tidak pernah dibuat.
    const rumus =
      'VERSION="$(echo "${GITHUB_SHA}" | cut -c1-12)-$(git show -s --format=%ct HEAD)"';

    expect(readWorkflow()).toContain(rumus);
    expect(readBuildWorkflow()).toContain(rumus);
  });

  it("only deploys commits that the GitHub build workflow also builds", () => {
    // Setiap pola yang diabaikan GitHub juga harus diabaikan Gitea. Kalau
    // tidak, Gitea bisa menunggu image untuk commit yang tidak pernah dibangun.
    const abaikanGitea = readPathsIgnore(readWorkflow());
    const abaikanGithub = readPathsIgnore(readBuildWorkflow());

    expect(abaikanGithub.length).toBeGreaterThan(0);
    for (const pola of abaikanGithub) {
      expect(abaikanGitea).toContain(pola);
    }
  });

  it("never applies the placeholder secret templates that live in the repo", () => {
    // `secrets.yaml` dan `registry-secret.yaml` berisi nilai contoh. Menerapkan
    // keduanya akan menimpa secret hidup di cluster dengan placeholder.
    const workflow = readWorkflow();

    expect(workflow).toContain(
      "secrets.yaml|registry-secret.yaml) continue ;;",
    );
  });

  it("renders manifests to files and refuses to apply leftover placeholders", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain('> "rendered/$(basename "$manifest")"');
    expect(workflow).toContain(
      "grep -rlF -e '{{APP_IMAGE}}' -e '{{CRON_IMAGE}}' -e '{{RADIUS_IMAGE}}' rendered/",
    );
    expect(workflow).toContain("Render manifes menyisakan placeholder");
  });

  it("passes the git revision into the app image build", () => {
    const workflow = readBuildWorkflow();

    expect(workflow).toContain("IMAGE_REVISION=${{ github.sha }}");
    expect(workflow).toContain(
      "labels: org.opencontainers.image.revision=${{ github.sha }}",
    );
  });

  it("verifies the image actually running after rollout, not just that apply succeeded", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("Verifikasi image yang benar-benar aktif");
    expect(workflow).toContain("rollout status deploy/");
  });
});
