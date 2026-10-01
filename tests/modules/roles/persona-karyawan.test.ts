import { PersonaKaryawan as PersonaKaryawanPrisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  DESKRIPSI_PERSONA_KARYAWAN,
  LABEL_PERSONA_KARYAWAN,
  PERSONA_KARYAWAN,
  PERSONA_KARYAWAN_DEFAULT,
  isPersonaKaryawan,
  toPersonaKaryawan,
} from "@/modules/roles/client";

describe("persona karyawan", () => {
  it("selaras persis dengan enum Prisma PersonaKaryawan", () => {
    expect([...PERSONA_KARYAWAN].sort()).toEqual(
      Object.values(PersonaKaryawanPrisma).sort(),
    );
  });

  it("default STAFF sesuai default kolom Role.persona", () => {
    expect(PERSONA_KARYAWAN_DEFAULT).toBe("STAFF");
  });

  it("punya label Indonesia dan deskripsi untuk tiap persona", () => {
    expect(LABEL_PERSONA_KARYAWAN).toEqual({
      STAFF: "Staff",
      TEKNISI: "Teknisi",
      SALES: "Sales",
      FINANCE: "Finance",
      DIREKTUR: "Direktur",
    });
    for (const persona of PERSONA_KARYAWAN) {
      expect(DESKRIPSI_PERSONA_KARYAWAN[persona].length).toBeGreaterThan(0);
    }
  });

  it("isPersonaKaryawan hanya menerima nilai enum", () => {
    expect(isPersonaKaryawan("SALES")).toBe(true);
    expect(isPersonaKaryawan("sales")).toBe(false);
    expect(isPersonaKaryawan("KARYAWAN_SALES")).toBe(false);
    expect(isPersonaKaryawan(undefined)).toBe(false);
    expect(isPersonaKaryawan(1)).toBe(false);
  });

  it("toPersonaKaryawan jatuh ke STAFF untuk nilai tidak sah", () => {
    expect(toPersonaKaryawan("TEKNISI")).toBe("TEKNISI");
    expect(toPersonaKaryawan(null)).toBe("STAFF");
    expect(toPersonaKaryawan("MITRA")).toBe("STAFF");
  });
});
