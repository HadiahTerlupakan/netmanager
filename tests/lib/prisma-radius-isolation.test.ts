import { describe, expect, it } from "vitest";
import { RADIUS_ISOLATION_EXEMPT_MODELS } from "@/lib/prisma-radius-isolation";

/**
 * Isolasi tenant pada database RADIUS.
 *
 * Sebelumnya SELURUH 9 tabel radius diteruskan ke parameter `ignoreModels`
 * milik `withTenantIsolation()` — lewat variabel bernama `tenantScopedModels`,
 * yang artinya justru kebalikan dari maksud parameternya. Efeknya: tidak ada
 * isolasi otomatis sama sekali, padahal schema-nya dirancang multi-tenant.
 */
describe("model radius yang dikecualikan dari isolasi tenant", () => {
  // Diverifikasi di database produksi: radpostauth berisi 54.749 baris dan
  // SEMUANYA ber-tenantId NULL, karena FreeRADIUS menulisnya langsung dan
  // tabel itu tidak punya trigger pengisi tenantId. Mengisolasinya akan
  // menyembunyikan seluruh log autentikasi dari aplikasi.
  it("mengecualikan radpostauth yang ditulis FreeRADIUS tanpa tenantId", () => {
    expect(RADIUS_ISOLATION_EXEMPT_MODELS).toContain("radpostauth");
  });

  // radacct punya trigger trg_radacct_set_tenantid (BEFORE INSERT/UPDATE) yang
  // mengisi tenantId di sisi database, jadi aman diisolasi.
  it("TIDAK mengecualikan radacct yang tenantId-nya diisi trigger", () => {
    expect(RADIUS_ISOLATION_EXEMPT_MODELS).not.toContain("radacct");
  });

  it.each([
    "radcheck",
    "radreply",
    "radusergroup",
    "radgroupcheck",
    "radgroupreply",
    "radippool",
    "nas",
  ])("TIDAK mengecualikan %s yang ditulis aplikasi", (model) => {
    expect(RADIUS_ISOLATION_EXEMPT_MODELS).not.toContain(model);
  });

  it("hanya satu model yang dikecualikan", () => {
    expect(RADIUS_ISOLATION_EXEMPT_MODELS).toHaveLength(1);
  });
});
