import { describe, expect, it } from "vitest";
import { hasCapability } from "@/lib/permission-aliases";

describe("hasCapability", () => {
  // Regresi: banyak service menulis `permissions.includes("users:read")`
  // langsung. Super admin memegang ["*"], sehingga includes() bernilai false
  // dan super admin justru ditolak — persis penyebab 403 pada
  // GET /api/admin/users/[id].
  it("meloloskan wildcard super admin", () => {
    expect(hasCapability(["*"], "users:read")).toBe(true);
  });

  it("meloloskan permission yang cocok persis", () => {
    expect(hasCapability(["users:read"], "users:read")).toBe(true);
  });

  it("menolak permission yang tidak dimiliki", () => {
    expect(hasCapability(["users:create"], "users:read")).toBe(false);
  });

  it("menghormati alias permission", () => {
    expect(hasCapability(["workorders:read"], "list:read")).toBe(true);
  });

  it("aman terhadap daftar kosong", () => {
    expect(hasCapability([], "users:read")).toBe(false);
  });

  it("aman terhadap daftar tak terdefinisi", () => {
    expect(hasCapability(undefined, "users:read")).toBe(false);
  });

  // Pembatas cakupan TIDAK boleh ikut cocok lewat wildcard: super admin yang
  // cocok dengan `users:site_only` justru akan terkurung di satu site.
  // Karena itu pembatas cakupan tetap memakai includes() biasa, bukan helper
  // ini — tes ini mengunci pemisahan tersebut supaya tidak tertukar.
  it("wildcard tetap mengembalikan true untuk string site_only bila dipaksa lewat helper ini", () => {
    expect(hasCapability(["*"], "users:site_only")).toBe(true);
  });
});
