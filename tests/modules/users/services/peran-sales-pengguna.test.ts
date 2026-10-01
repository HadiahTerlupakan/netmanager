import { describe, expect, it } from "vitest";
import {
  isSalesPengguna,
  personaPengguna,
} from "@/modules/users/services/peran-sales-pengguna";

const role = (persona?: "STAFF" | "TEKNISI" | "SALES" | "FINANCE" | "DIREKTUR", izin: string[] = []) => ({
  isSuperAdmin: false,
  persona,
  permission: izin.map((i) => ({ resource: i.split(":")[0], action: i.split(":")[1] })),
});

const IZIN_KEPALA_SALES = ["presurvei_rencana:read", "presurvei_rencana:create"];

describe("personaPengguna", () => {
  it("memakai persona role", () => {
    expect(personaPengguna({ role: role("TEKNISI") })).toBe("TEKNISI");
    expect(personaPengguna({ role: role("DIREKTUR") })).toBe("DIREKTUR");
    expect(personaPengguna({ role: role("SALES") })).toBe("SALES");
  });

  it("izin kepala sales tidak lagi mengubah persona: role STAFF tetap STAFF", () => {
    expect(personaPengguna({ role: role("STAFF", IZIN_KEPALA_SALES) })).toBe("STAFF");
  });

  it("tanpa role atau persona kosong (data lama) → STAFF", () => {
    expect(personaPengguna({ role: null })).toBe("STAFF");
    expect(personaPengguna({ role: role(undefined) })).toBe("STAFF");
  });
});

describe("isSalesPengguna", () => {
  it("hanya persona role SALES yang dianggap sales", () => {
    expect(isSalesPengguna({ role: role("SALES") })).toBe(true);
    expect(isSalesPengguna({ role: role("TEKNISI") })).toBe(false);
    expect(isSalesPengguna({ role: null })).toBe(false);
  });

  it("izin kepala sales tanpa persona SALES bukan sales", () => {
    expect(isSalesPengguna({ role: role("STAFF", IZIN_KEPALA_SALES) })).toBe(false);
  });
});
