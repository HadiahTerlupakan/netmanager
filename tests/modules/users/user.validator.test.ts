import { describe, expect, it } from "vitest";

import {
  createUserSchema,
  PESAN_KEPALA_SALES_DIRI_SENDIRI,
  updateUserSchema,
  validateKepalaSalesAssignment,
} from "@/modules/users/validation";

describe("updateUserSchema", () => {
  it("menolak userSites dengan siteId duplikat", () => {
    const result = updateUserSchema.safeParse({
      userSites: [
        { siteId: "site-1", isPrimary: true },
        { siteId: "site-1", isPrimary: false },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Schema unexpectedly accepted duplicate userSites");
    }

    expect(result.error.issues[0]?.message).toBe(
      "Site user tidak boleh duplikat",
    );
  });

  it("menolak userSites tanpa tepat satu site utama", () => {
    const result = updateUserSchema.safeParse({
      userSites: [
        { siteId: "site-1", isPrimary: false },
        { siteId: "site-2", isPrimary: false },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Schema unexpectedly accepted missing primary site");
    }

    expect(result.error.issues[0]?.message).toBe("Pilih tepat satu site utama");
  });
});

describe("kepalaSalesId", () => {
  it("create & update menerima id, null, dan string kosong sebagai null", () => {
    expect(updateUserSchema.parse({ kepalaSalesId: "k-1" }).kepalaSalesId).toBe(
      "k-1",
    );
    // null = lepas dari tim; tidak boleh diubah jadi undefined (tanpa perubahan).
    expect(
      updateUserSchema.parse({ kepalaSalesId: null }).kepalaSalesId,
    ).toBeNull();
    expect(
      updateUserSchema.parse({ kepalaSalesId: "" }).kepalaSalesId,
    ).toBeNull();
    expect(
      createUserSchema.parse({
        email: "a@b.co",
        name: "A",
        password: "rahasia123",
        kepalaSalesId: null,
      }).kepalaSalesId,
    ).toBeNull();
  });

  it("menolak kepala sales = user itu sendiri", () => {
    expect(validateKepalaSalesAssignment("u-1", "u-1")).toBe(
      PESAN_KEPALA_SALES_DIRI_SENDIRI,
    );
  });

  it("menerima kepala sales lain, lepas tim, atau tanpa perubahan", () => {
    expect(validateKepalaSalesAssignment("u-1", "k-1")).toBeNull();
    expect(validateKepalaSalesAssignment("u-1", null)).toBeNull();
    expect(validateKepalaSalesAssignment("u-1", undefined)).toBeNull();
  });
});
