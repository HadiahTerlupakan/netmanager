import { describe, expect, it } from "vitest";
import { createRoleSchema, updateRoleSchema } from "@/modules/roles";

const roleDasar = { name: "Sales Lapangan", permissions: ["m_presurvei:read"] };

describe("createRoleSchema — persona", () => {
  it("default STAFF bila persona tidak dikirim", () => {
    expect(createRoleSchema.parse(roleDasar).persona).toBe("STAFF");
  });

  it("menerima tiap persona sah", () => {
    for (const persona of ["STAFF", "TEKNISI", "SALES", "FINANCE", "DIREKTUR"]) {
      expect(createRoleSchema.parse({ ...roleDasar, persona }).persona).toBe(
        persona,
      );
    }
  });

  it("menolak persona tidak sah dengan pesan Indonesia", () => {
    const hasil = createRoleSchema.safeParse({ ...roleDasar, persona: "MITRA" });
    expect(hasil.success).toBe(false);
    expect(hasil.error?.issues[0]?.message).toBe("Persona tidak valid");
  });

  it("menolak persona huruf kecil", () => {
    expect(
      createRoleSchema.safeParse({ ...roleDasar, persona: "sales" }).success,
    ).toBe(false);
  });
});

describe("updateRoleSchema — persona", () => {
  it("tidak mengisi default agar persona lama tidak tertimpa", () => {
    expect(updateRoleSchema.parse(roleDasar).persona).toBeUndefined();
  });

  it("meneruskan persona sah", () => {
    expect(
      updateRoleSchema.parse({ ...roleDasar, persona: "TEKNISI" }).persona,
    ).toBe("TEKNISI");
  });

  it("menolak persona tidak sah", () => {
    expect(
      updateRoleSchema.safeParse({ ...roleDasar, persona: "INVESTOR" }).success,
    ).toBe(false);
  });
});
