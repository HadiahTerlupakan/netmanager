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
    const workflow = readWorkflow();

    expect(workflow).toContain("npm ci --no-audit --prefer-offline");
    expect(workflow).not.toContain("npm install");
  });

  it("generates the Prisma client explicitly after install, not as a postinstall side effect", () => {
    // `--ignore-scripts` mematikan postinstall, jadi generate harus dipanggil
    // sendiri. Versi paralelnya sengaja tidak dipakai: puncak pemakaian RAM-nya
    // menjatuhkan job.
    const workflow = readWorkflow();
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

    // Ketiga image didorong, dan deploy menunggu job build selesai.
    expect(workflow.match(/docker push "\$IMAGE"/g) ?? []).toHaveLength(3);
    expect(workflow).toMatch(/deploy:\s*\n\s+needs: build/);
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
    const workflow = readWorkflow();

    expect(workflow).toContain('--build-arg IMAGE_REVISION="${GITHUB_SHA}"');
    expect(workflow).toContain(
      '--label org.opencontainers.image.revision="${GITHUB_SHA}"',
    );
  });

  it("verifies the image actually running after rollout, not just that apply succeeded", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("Verifikasi image yang benar-benar aktif");
    expect(workflow).toContain("rollout status deploy/");
  });
});
