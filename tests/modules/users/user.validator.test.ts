import { describe, expect, it } from "vitest";

import { updateUserSchema } from "@/modules/users/validation";

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
