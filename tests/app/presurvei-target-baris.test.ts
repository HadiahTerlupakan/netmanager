import { describe, expect, it } from "vitest";

import {
  keBarisTarget,
  labelSalesTarget,
} from "@/app/admin/presurvei/target/barisTarget";
import type { SalesPresurveiDto, TargetDto } from "@/modules/presurvei/client";

const DAFTAR_SALES: readonly SalesPresurveiDto[] = Object.freeze([
  { id: "user-rina-000111", nama: "Rina" },
  { id: "user-budi-000222", nama: "Budi" },
]);

describe("labelSalesTarget", () => {
  it("memakai nama dari daftar sales aktif", () => {
    expect(labelSalesTarget("user-budi-000222", DAFTAR_SALES)).toBe("Budi");
  });

  it("memberi label netral berpotongan ujung id untuk sales di luar daftar", () => {
    // Daftar hanya berisi sales AKTIF, jadi target milik sales yang sudah
    // nonaktif tidak menemukan namanya. Label ini tidak membuka email dan
    // tidak mencetak id utuh.
    expect(labelSalesTarget("cl0000000000abc987", DAFTAR_SALES)).toBe(
      "Sales tak tercantum (…abc987)",
    );
  });
});

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
