import { describe, expect, it } from "vitest";

import { labelSales } from "@/app/admin/presurvei/labelSales";
import type { SalesPresurveiDto } from "@/modules/presurvei/client";

/**
 * Label sales bersama layar target dan laporan. Keduanya hanya membawa
 * `userId` (`modules/presurvei/dto/target.dto.ts:8-26`).
 */

const DAFTAR_SALES: readonly SalesPresurveiDto[] = Object.freeze([
  { id: "user-rina-000111", nama: "Rina" },
  { id: "user-budi-000222", nama: "Budi" },
]);

describe("labelSales", () => {
  it("memakai nama dari daftar sales aktif", () => {
    expect(labelSales("user-budi-000222", DAFTAR_SALES)).toBe("Budi");
  });

  it("memberi label netral berpotongan ujung id untuk sales di luar daftar", () => {
    // Daftar hanya berisi sales AKTIF, jadi target milik sales yang sudah
    // nonaktif tidak menemukan namanya. Label ini tidak membuka email dan
    // tidak mencetak id utuh.
    expect(labelSales("cl0000000000abc987", DAFTAR_SALES)).toBe(
      "Sales tak tercantum (…abc987)",
    );
  });
});
