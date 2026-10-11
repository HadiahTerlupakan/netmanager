import { describe, expect, it } from "vitest";

import {
  KATEGORI_DOKUMEN,
  KATEGORI_LAMPIRAN_PROYEK,
  LABEL_KATEGORI_DOKUMEN,
  labelKategoriDokumen,
} from "@/modules/planning/domain/kategori-dokumen";
import { unggahDokumenPlanningSchema } from "@/modules/planning/validators/planningDocumentSchemas";

/**
 * Daftar kategori dokumen dipakai tiga pihak: validator unggah, form pemilihan
 * kategori, dan daftar dokumen. Sebelumnya masing-masing memegang salinannya
 * sendiri, dan daftar dokumen tidak punya salinan sama sekali sehingga
 * memuntahkan nilai enum mentah tepat di bawah form yang menamainya lain.
 */
describe("kategori dokumen planning", () => {
  it("memberi label manusiawi untuk setiap kategori yang dikenal", () => {
    for (const kategori of KATEGORI_DOKUMEN) {
      const label = LABEL_KATEGORI_DOKUMEN[kategori];
      expect(label, `kategori ${kategori} tanpa label`).toBeTruthy();
      // Label yang masih berbentuk enum berarti pembaca tetap melihat nama
      // kolom basis data.
      expect(label).not.toBe(kategori);
    }
  });

  it("menawarkan setiap kategori lampiran proyek kecuali foto survei", () => {
    expect(KATEGORI_LAMPIRAN_PROYEK).not.toContain("SURVEY_PHOTO");
    for (const kategori of KATEGORI_DOKUMEN) {
      if (kategori === "SURVEY_PHOTO") continue;
      expect(KATEGORI_LAMPIRAN_PROYEK).toContain(kategori);
    }
  });

  it("menerima nilai tak dikenal apa adanya, bukan kosong", () => {
    // Baris lama atau kategori baru yang belum diberi label tetap harus
    // terbaca, bukan hilang dari kartu dokumen.
    expect(labelKategoriDokumen("KATEGORI_BARU")).toBe("KATEGORI_BARU");
  });

  it("validator unggah menerima persis daftar yang sama", () => {
    for (const kategori of KATEGORI_DOKUMEN) {
      const hasil = unggahDokumenPlanningSchema.safeParse({
        category: kategori,
      });
      expect(hasil.success, `kategori ${kategori} ditolak validator`).toBe(
        true,
      );
    }
    expect(
      unggahDokumenPlanningSchema.safeParse({ category: "BUKAN_KATEGORI" })
        .success,
    ).toBe(false);
  });
});
