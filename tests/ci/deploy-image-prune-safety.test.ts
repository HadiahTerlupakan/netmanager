import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Langkah pemangkasan image di `deploy-production.yml` MENGHAPUS di node
 * produksi. Penjaga ini menahan sifat-sifat yang membuatnya aman, karena
 * menyederhanakannya jadi "hapus semua yang lama" adalah penyederhanaan yang
 * masuk akal secara sekilas dan berbahaya secara nyata.
 *
 * Latar (2026-09-22): tiap deploy meninggalkan satu image `netmanager-app`
 * baru, dan kubelet baru membersihkannya saat disk menyentuh 85%. Sudah
 * menumpuk 8; menghapus 5 yang terlama membebaskan 13 GB.
 */

function readWorkflow(): string {
  return readFileSync(
    resolve(process.cwd(), ".gitea/workflows/deploy-production.yml"),
    "utf8",
  );
}

/** Isi langkah pemangkasan saja, supaya asersi tidak tertolong langkah lain. */
function getPruneStep(workflow: string): string {
  const mulai = workflow.indexOf("- name: Pangkas image aplikasi lama di node");
  if (mulai === -1) return "";

  const berikutnya = workflow.indexOf("\n      - name:", mulai + 1);
  return berikutnya === -1
    ? workflow.slice(mulai)
    : workflow.slice(mulai, berikutnya);
}

describe("pemangkasan image produksi tetap aman", () => {
  it("langkah pemangkasan ada di workflow deploy", () => {
    expect(getPruneStep(readWorkflow())).not.toBe("");
  });

  it("melewati image yang masih dirujuk workload", () => {
    const langkah = getPruneStep(readWorkflow());

    // Tanpa ini, image yang sedang berjalan bisa ikut terhapus begitu ia
    // bergeser keluar dari N terbaru — misalnya saat beberapa deploy gagal
    // beruntun sehingga produksi tertinggal di tag lama.
    expect(langkah).toContain("kubectl get pods,deploy,statefulset");
    expect(langkah).toMatch(/grep -qx "\$\{tag\}"/);
  });

  it("menyisakan lebih dari satu image untuk rollback", () => {
    const workflow = readWorkflow();
    const jumlah = workflow.match(/JUMLAH_IMAGE_DISIMPAN:\s*"(\d+)"/)?.[1];

    expect(jumlah).toBeDefined();
    expect(Number(jumlah)).toBeGreaterThanOrEqual(2);
    // Yang dipangkas hanya yang DI LUAR N teratas.
    expect(getPruneStep(workflow)).toContain(
      "tail -n +$((JUMLAH_DISIMPAN + 1))",
    );
  });

  it("hanya menyasar netmanager-app", () => {
    const langkah = getPruneStep(readWorkflow());

    // Tag `netmanager-cron` dan `netmanager-radius` memang banyak, tetapi
    // semuanya menunjuk satu image id yang sama — memangkasnya tidak
    // membebaskan disk sama sekali, dan hanya menambah risiko.
    expect(langkah).toContain("REPO=netmanager-app");
    expect(langkah).not.toContain("REPO=netmanager-cron");
    expect(langkah).not.toContain("REPO=netmanager-radius");
  });

  it("memberi crictl tenggat yang cukup untuk menghapus snapshot", () => {
    const langkah = getPruneStep(readWorkflow());

    // Tenggat bawaan `crictl` 2 detik, sementara penghapusan snapshot jauh
    // lebih lama. Tanpa `--timeout` ia melapor DeadlineExceeded padahal
    // penghapusannya tetap berjalan sampai selesai — log jadi menyesatkan.
    expect(langkah).toMatch(/crictl --timeout \d+s rmi/);
  });
});
