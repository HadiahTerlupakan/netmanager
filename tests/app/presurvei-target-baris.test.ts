import { describe, expect, it } from "vitest";

import {
  cariTargetSales,
  keBarisTarget,
  labelOpsiSales,
  pesanTabelKosong,
  type BarisTarget,
} from "@/app/admin/presurvei/target/barisTarget";
import type { SalesPresurveiDto, TargetDto } from "@/modules/presurvei/client";

const DAFTAR_SALES: readonly SalesPresurveiDto[] = Object.freeze([
  { id: "user-rina-000111", nama: "Rina" },
  { id: "user-budi-000222", nama: "Budi" },
]);

describe("keBarisTarget", () => {
  it("menempelkan label sales ke setiap target tanpa mengubah angkanya", () => {
    const target: TargetDto = Object.freeze({
      id: "target-1",
      userId: "user-rina-000111",
      periodeTahun: 2026,
      periodeBulan: 9,
      targetKunjungan: 40,
      targetProspek: 12,
      targetKonversi: 3,
      updatedAt: "2026-09-01T00:00:00.000Z",
    });

    expect(keBarisTarget([target], DAFTAR_SALES)).toEqual([
      {
        id: "target-1",
        userId: "user-rina-000111",
        periodeTahun: 2026,
        periodeBulan: 9,
        targetKunjungan: 40,
        targetProspek: 12,
        targetKonversi: 3,
        updatedAt: "2026-09-01T00:00:00.000Z",
        namaSales: "Rina",
      },
    ]);
  });
});

const BARIS_RINA: BarisTarget = Object.freeze({
  id: "target-rina",
  userId: "user-rina-000111",
  periodeTahun: 2026,
  periodeBulan: 9,
  targetKunjungan: 40,
  targetProspek: 12,
  targetKonversi: 3,
  updatedAt: "2026-09-01T00:00:00.000Z",
  namaSales: "Rina",
});

describe("cariTargetSales", () => {
  it("menemukan target periode milik sales yang dipilih", () => {
    expect(cariTargetSales("user-rina-000111", [BARIS_RINA])).toBe(BARIS_RINA);
  });

  it("mengembalikan null untuk sales tanpa target, bukan undefined", () => {
    expect(cariTargetSales("user-budi-000222", [BARIS_RINA])).toBeNull();
  });

  it("tidak mencocokkan pilihan kosong ke baris mana pun", () => {
    expect(cariTargetSales("", [BARIS_RINA])).toBeNull();
  });
});

describe("labelOpsiSales", () => {
  it("memberi akhiran pada sales yang sudah punya target periode ini", () => {
    // Tanpa akhiran ini, mode buat menimpa target lama tanpa pernah
    // memperlihatkannya.
    expect(labelOpsiSales(DAFTAR_SALES[0], [BARIS_RINA])).toBe(
      "Rina (sudah ada target)",
    );
  });

  it("memakai nama apa adanya untuk sales tanpa target", () => {
    expect(labelOpsiSales(DAFTAR_SALES[1], [BARIS_RINA])).toBe("Budi");
  });
});

describe("pesanTabelKosong", () => {
  it("membedakan gagal memuat dari periode yang memang tanpa target", () => {
    // Tanpa pembeda ini GET yang gagal tampil sebagai "Belum ada target",
    // dan pemakai menetapkan ulang target yang sebenarnya sudah ada.
    expect(pesanTabelKosong(true)).toBe("Target gagal dimuat.");
    expect(pesanTabelKosong(false)).toBe("Belum ada target untuk periode ini.");
  });
});
