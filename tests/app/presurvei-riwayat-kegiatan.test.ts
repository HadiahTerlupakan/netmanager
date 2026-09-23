import { describe, expect, it } from "vitest";

/**
 * Baris riwayat di halaman rincian: siapa, kapan, medan dari → ke. `dari`
 * dan `ke` bersebelahan dan sama-sama string, jadi fixture memakai nilai
 * yang berbeda supaya tertukarnya terlihat.
 *
 * Teks waktu bergantung pada pemakuan TZ Asia/Jakarta di `tests/setup.ts`.
 */

import {
  keBarisRiwayat,
  TEKS_PENGUBAH_TAK_DIKENAL,
} from "@/app/admin/presurvei/kegiatan/[id]/riwayatKegiatan";
import type { RiwayatKegiatanDto } from "@/modules/presurvei/client";

const riwayat: RiwayatKegiatanDto = {
  id: "riwayat-1",
  diubahOlehId: "admin-3",
  namaPengubah: "Admin Tiga",
  diubahPada: "2026-09-23T02:30:00.000Z",
  perubahan: {
    hasil: { dari: "TERTARIK", ke: "DEAL" },
    catatan: { dari: null, ke: "Minta sore" },
  },
};

describe("keBarisRiwayat", () => {
  it("menyusun pelaku, waktu terformat, dan perubahan berlabel dalam urutan tetap", () => {
    expect(keBarisRiwayat(riwayat)).toEqual({
      id: "riwayat-1",
      pelaku: "Admin Tiga",
      waktu: "23 Sep 2026 09:30",
      perubahan: [
        { medan: "catatan", label: "Catatan", dari: "-", ke: "Minta sore" },
        { medan: "hasil", label: "Hasil", dari: "Tertarik", ke: "Deal" },
      ],
    });
  });

  it("memakai teks pengganti bila nama pengubah tidak bisa ditampilkan", () => {
    expect(keBarisRiwayat({ ...riwayat, namaPengubah: null }).pelaku).toBe(
      TEKS_PENGUBAH_TAK_DIKENAL,
    );
  });

  it("menampilkan string kosong apa adanya, bukan sebagai '-'", () => {
    const baris = keBarisRiwayat({
      ...riwayat,
      perubahan: { ditemuiNama: { dari: "", ke: null } },
    });

    expect(baris.perubahan).toEqual([
      { medan: "ditemuiNama", label: "Ditemui", dari: "", ke: "-" },
    ]);
  });
});
