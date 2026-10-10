import { describe, expect, it } from "vitest";
import { ROLE_TEMPLATES } from "@/lib/role-templates";
import { isPersonaKaryawan } from "@/modules/roles/client";

const personaPerTemplate = Object.fromEntries(
  ROLE_TEMPLATES.map((template) => [template.id, template.persona]),
);

describe("ROLE_TEMPLATES — persona", () => {
  it("setiap template punya persona sah", () => {
    for (const template of ROLE_TEMPLATES) {
      expect(isPersonaKaryawan(template.persona), template.id).toBe(true);
    }
  });

  it("memetakan template ke persona yang sesuai tugasnya", () => {
    expect(personaPerTemplate).toEqual({
      teknisi: "TEKNISI",
      "staff-kantor": "STAFF",
      admin: "STAFF",
      helpdesk: "STAFF",
      "staff-keuangan": "FINANCE",
      sales: "SALES",
      kepala_sales: "SALES",
      head_of_sales: "SALES",
      manager: "STAFF",
      noc: "STAFF",
      "inventory-staff": "TEKNISI",
      hrd: "STAFF",
    });
  });

  it("template berpersona TEKNISI memegang izin lapangan mobile (work order atau barang)", () => {
    for (const template of ROLE_TEMPLATES.filter(
      (item) => item.persona === "TEKNISI",
    )) {
      const isPunyaIzinLapangan = template.permissions.some(
        (izin) => izin === "m_work_order:read" || izin === "m_barang:read",
      );
      expect(isPunyaIzinLapangan, template.id).toBe(true);
    }
  });

  it("template berpersona SALES memegang izin presurvei mobile", () => {
    for (const template of ROLE_TEMPLATES.filter(
      (item) => item.persona === "SALES",
    )) {
      expect(template.permissions, template.id).toContain("m_presurvei:read");
    }
  });
});

describe("template Head of Sales & Marketing", () => {
  it("melihat SEMUA sales (view_all), kepala sales hanya timnya", async () => {
    const { ROLE_TEMPLATES } = await import("@/lib/role-templates");
    const { jenisLingkupDariIzin } = await import("@/modules/roles/client");
    const ambil = (id: string) =>
      ROLE_TEMPLATES.find((template) => template.id === id)!;

    expect(jenisLingkupDariIzin(ambil("head_of_sales").permissions)).toBe(
      "SEMUA",
    );
    expect(jenisLingkupDariIzin(ambil("kepala_sales").permissions)).toBe("TIM");
    expect(ambil("head_of_sales").permissions).not.toContain(
      "pelanggan:update",
    );
  });
});
