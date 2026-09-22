import { describe, expect, it } from "vitest";

/**
 * Penentu aksi saat kartu dijatuhkan ke sebuah kolom. Murni dan di domain,
 * karena interaksi seretnya sendiri tidak dapat diuji — repo ini tidak punya
 * DOM palsu.
 */

import { PROSPEK_STATUSES } from "@/modules/presurvei/domain/entities/Prospek";
import { resolveAksiKanban } from "@/modules/presurvei/domain/prospek-kanban";
import { isTransisiStatusSah } from "@/modules/presurvei/domain/prospek-rules";

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

  it("tidak membuka form untuk tujuan lain dari NEGOSIASI", () => {
    // NEGOSIASI satu-satunya status yang punya jalur ke DEAL. Tanpa kasus ini
    // cabang `ke === "DEAL"` bisa ditukar jadi `dari === "NEGOSIASI"` tanpa
    // satu pun test merah — lalu sales yang menyeret kartu ke "Tidak Minat"
    // disambut form konversi yang meminta KTP dan paket.
    expect(resolveAksiKanban("NEGOSIASI", "TIDAK_MINAT")).toEqual({
      jenis: "ubah-status",
      tujuan: "TIDAK_MINAT",
    });
  });

  it("sepakat dengan isTransisiStatusSah untuk ke-49 pasangan status", () => {
    // Inilah yang benar-benar mengunci "tidak menyalin tabel transisi".
    // Menyalin `TRANSISI_SAH` ke dalam berkas ini tidak berbahaya selama
    // nilainya sama — bahayanya muncul saat kedua salinan menyimpang, dan di
    // situlah test ini merah. Test bernilai tunggal tidak bisa melihatnya.
    for (const dari of PROSPEK_STATUSES) {
      for (const ke of PROSPEK_STATUSES) {
        // Pasangan ikut di-assert supaya kegagalannya menyebut pasangan mana
        // yang menyimpang; `expect(false).toBe(true)` tidak memberi tahu apa pun.
        expect({
          dari,
          ke,
          adaAksi: resolveAksiKanban(dari, ke) !== null,
        }).toEqual({
          dari,
          ke,
          adaAksi: dari !== ke && isTransisiStatusSah(dari, ke),
        });
      }
    }
  });

  it("mengizinkan jalan kembali dari TIDAK_MINAT ke DIHUBUNGI", () => {
    // Prospek mati bukan jalan buntu: pelanggan bisa berubah pikiran, dan
    // papan harus mengizinkan kartunya ditarik kembali ke corong hidup.
    // Contoh konkret yang menemani test ke-49-pasangan di atas.
    expect(resolveAksiKanban("TIDAK_MINAT", "DIHUBUNGI")).toEqual({
      jenis: "ubah-status",
      tujuan: "DIHUBUNGI",
    });
  });
});
