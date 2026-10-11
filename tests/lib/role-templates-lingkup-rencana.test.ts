import { describe, expect, it } from "vitest";
import { ROLE_TEMPLATES } from "@/lib/role-templates";
import { jenisLingkupDariIzin } from "@/modules/roles/domain/lingkup-presurvei";

/**
 * Lingkup rencana yang dihasilkan tiap template.
 *
 * Seluruh permukaan "pemberi tugas" di mobile — penugasan rencana, kartu tim,
 * penilaian kinerja tim — hanya muncul bila `jenisLingkupDariIzin` menjawab
 * TIM atau SEMUA. Penentunya izin web `presurvei_rencana:create`, yang mudah
 * terlepas saat daftar izin template dirapikan: hasilnya role kepala sales
 * diam-diam turun menjadi sales biasa, tanpa galat dan tanpa tes yang merah.
 * Dan lingkup saja tidak cukup — tanpa `accessEmployeePanel` pemegangnya tak
 * pernah bisa membuka aplikasi tempat permukaan itu berada.
 */

const lingkupPerTemplate = Object.fromEntries(
  ROLE_TEMPLATES.map((t) => [t.id, jenisLingkupDariIzin([...t.permissions])]),
);

describe("ROLE_TEMPLATES — lingkup rencana presurvei", () => {
  it("kepala sales berlingkup TIM, head of sales berlingkup SEMUA", () => {
    expect(lingkupPerTemplate.kepala_sales).toBe("TIM");
    expect(lingkupPerTemplate.head_of_sales).toBe("SEMUA");
  });

  it("sales biasa tetap berlingkup SENDIRI", () => {
    expect(lingkupPerTemplate.sales).toBe("SENDIRI");
  });

  // Lingkup tanpa pintu masuk mobile = fitur yang tak pernah terjangkau,
  // persis asimetri yang dulu membuat persona STAFF tidak punya role.
  it("setiap template pemberi tugas bisa membuka aplikasi mobile", () => {
    const pemberiTugas = ROLE_TEMPLATES.filter(
      (t) => lingkupPerTemplate[t.id] !== "SENDIRI" && t.persona === "SALES",
    );

    expect(pemberiTugas.length).toBeGreaterThan(0);
    for (const t of pemberiTugas) {
      expect(t.accessEmployeePanel, t.id).toBe(true);
    }
  });
});
