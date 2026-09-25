import { describe, expect, it } from "vitest";

import {
  deployScriptSectionIndex,
  readDeployScriptNumber,
  readDeployScriptSection,
} from "../helpers/deploy-sources";

/**
 * Langkah pemangkasan image di skrip deploy produksi
 * (`scripts/deploy/netmanager-deploy.sh`, bagian 9) MENGHAPUS di node
 * produksi. Penjaga ini menahan sifat-sifat yang membuatnya aman, karena
 * menyederhanakannya jadi "hapus semua yang lama" adalah penyederhanaan yang
 * masuk akal secara sekilas dan berbahaya secara nyata.
 *
 * Latar (2026-09-22): tiap deploy meninggalkan satu image `netmanager-app`
 * baru, dan kubelet baru membersihkannya saat disk menyentuh 85%. Sudah
 * menumpuk 8; menghapus 5 yang terlama membebaskan 13 GB.
 */

const PRUNE = "9.";

function getPruneStep(): string {
  return readDeployScriptSection(PRUNE);
}

describe("pemangkasan image produksi tetap aman", () => {
  it("langkah pemangkasan ada di skrip deploy", () => {
    expect(getPruneStep()).toContain("crictl");
  });

  it("baru berjalan setelah image aktif terverifikasi", () => {
    // Deploy yang gagal di tengah tidak boleh sempat memangkas sasaran rollback.
    expect(deployScriptSectionIndex("8.")).toBeLessThan(
      deployScriptSectionIndex(PRUNE),
    );
  });

  it("melewati image yang masih dirujuk workload", () => {
    const langkah = getPruneStep();

    // Tanpa ini, image yang sedang berjalan bisa ikut terhapus begitu ia
    // bergeser keluar dari N terbaru — misalnya saat beberapa deploy gagal
    // beruntun sehingga produksi tertinggal di tag lama.
    expect(langkah).toContain("kubectl get pods,deploy,statefulset");
    expect(langkah).toMatch(/grep -qx "\$\{tag\}" <<< "\$\{dipakai\}"/);
  });

  it("menyisakan lebih dari satu image untuk rollback", () => {
    expect(readDeployScriptNumber("JUMLAH_IMAGE_DISIMPAN")).toBeGreaterThanOrEqual(2);
    // Yang dipangkas hanya yang DI LUAR N teratas.
    expect(getPruneStep()).toContain(
      "tail -n +$((JUMLAH_IMAGE_DISIMPAN + 1))",
    );
  });

  it("hanya menyasar netmanager-app", () => {
    const langkah = getPruneStep();

    // Tag `netmanager-cron` dan `netmanager-radius` memang banyak, tetapi
    // semuanya menunjuk satu image id yang sama — memangkasnya tidak
    // membebaskan disk sama sekali, dan hanya menambah risiko.
    expect(langkah).toMatch(/^REPO_IMAGE=netmanager-app$/m);
    expect(langkah).not.toContain("REPO_IMAGE=netmanager-cron");
    expect(langkah).not.toContain("REPO_IMAGE=netmanager-radius");
  });

  it("memberi crictl tenggat yang cukup untuk menghapus snapshot", () => {
    // Tenggat bawaan `crictl` 2 detik, sementara penghapusan snapshot jauh
    // lebih lama. Tanpa `--timeout` ia melapor DeadlineExceeded padahal
    // penghapusannya tetap berjalan sampai selesai — log jadi menyesatkan.
    expect(getPruneStep()).toMatch(/crictl --timeout \d+s rmi/);
  });
});
