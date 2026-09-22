import { describe, expect, it } from "vitest";

/**
 * Penentu aksi saat kartu dijatuhkan ke sebuah kolom. Murni dan di domain,
 * karena interaksi seretnya sendiri tidak dapat diuji — repo ini tidak punya
 * DOM palsu.
 */

import { resolveAksiKanban } from "@/modules/presurvei/domain/prospek-kanban";

describe("resolveAksiKanban", () => {
  it("mengizinkan perpindahan yang sah menurut aturan domain", () => {
    expect(resolveAksiKanban("BARU", "DIHUBUNGI")).toEqual({
      jenis: "ubah-status",
      tujuan: "DIHUBUNGI",
    });
  });

  it("menolak perpindahan yang tidak sah", () => {
    // BARU tidak boleh langsung DEAL: aturannya hanya mengizinkan DIHUBUNGI
    // atau TIDAK_MINAT. Tanpa penolakan ini, kolom DEAL akan menyala saat
    // kartu BARU diangkat lalu servernya yang menolak.
    expect(resolveAksiKanban("BARU", "DEAL")).toBeNull();
    expect(resolveAksiKanban("DEAL", "BARU")).toBeNull();
  });

  it("menolak menjatuhkan kartu ke kolomnya sendiri", () => {
    expect(resolveAksiKanban("NEGOSIASI", "NEGOSIASI")).toBeNull();
  });

  it("meminta form konversi saat tujuannya DEAL", () => {
    // DEAL bukan sekadar ganti status — ia mempromosikan prospek menjadi
    // canvasing, dan itu butuh nomor KTP serta paket yang tidak ada di prospek.
    expect(resolveAksiKanban("NEGOSIASI", "DEAL")).toEqual({
      jenis: "buka-konversi",
    });
  });

  it("memakai aturan domain, bukan daftar tersendiri", () => {
    // TIDAK_MINAT punya jalan kembali ke DIHUBUNGI — pelanggan bisa berubah
    // pikiran. Kalau fungsi ini menyalin daftar transisinya sendiri alih-alih
    // memanggil isTransisiStatusSah, kasus ini yang paling mungkin terlewat.
    expect(resolveAksiKanban("TIDAK_MINAT", "DIHUBUNGI")).toEqual({
      jenis: "ubah-status",
      tujuan: "DIHUBUNGI",
    });
  });
});
