import { describe, expect, it } from "vitest";
import {
  departemenPelakuSatuTenant,
  IS_SALES_PER_PERAN,
  peranPelakuSatuTenant,
  type IdentitasPelakuBertenant,
} from "@/modules/presurvei/domain/peran-pelaku";

/**
 * Peran dan departemen pelaku kegiatan.
 *
 * `include` bersarang tidak disaring ekstensi tenant, jadi kedua medan dijaga
 * per baris — sama seperti nama sales. Departemen dijaga dua kali: pelakunya
 * satu tenant dengan baris, dan departemennya juga.
 */

const pelaku = (
  ubahan: Partial<IdentitasPelakuBertenant> = {},
): IdentitasPelakuBertenant => ({
  id: "user-rina-01",
  name: "Rina",
  tenantId: "tenant-a",
  isSales: false,
  departments: { name: "Teknik", tenantId: "tenant-a" },
  ...ubahan,
});

describe("peranPelakuSatuTenant", () => {
  it("SALES bila isSales true", () => {
    expect(peranPelakuSatuTenant(pelaku({ isSales: true }), "tenant-a")).toBe(
      "SALES",
    );
  });

  it("NON_SALES bila isSales false", () => {
    expect(peranPelakuSatuTenant(pelaku({ isSales: false }), "tenant-a")).toBe(
      "NON_SALES",
    );
  });

  it("null untuk pelaku tenant lain, sales atau bukan", () => {
    expect(
      peranPelakuSatuTenant(
        pelaku({ tenantId: "tenant-b", isSales: true }),
        "tenant-a",
      ),
    ).toBeNull();
    expect(
      peranPelakuSatuTenant(
        pelaku({ tenantId: "tenant-b", isSales: false }),
        "tenant-a",
      ),
    ).toBeNull();
  });

  it("null tanpa join, dan null — bukan NON_SALES — bila isSales tidak ter-select", () => {
    expect(peranPelakuSatuTenant(null, "tenant-a")).toBeNull();
    expect(peranPelakuSatuTenant(undefined, "tenant-a")).toBeNull();
    expect(
      peranPelakuSatuTenant(pelaku({ isSales: undefined }), "tenant-a"),
    ).toBeNull();
  });
});

describe("departemenPelakuSatuTenant", () => {
  it("nama departemen bila pelaku dan departemennya satu tenant dengan baris", () => {
    expect(departemenPelakuSatuTenant(pelaku(), "tenant-a")).toBe("Teknik");
  });

  it("null bila departemen milik tenant lain walau pelakunya satu tenant", () => {
    expect(
      departemenPelakuSatuTenant(
        pelaku({ departments: { name: "Rahasia B", tenantId: "tenant-b" } }),
        "tenant-a",
      ),
    ).toBeNull();
  });

  it("null bila departemen tak bertenant pada baris bertenant", () => {
    expect(
      departemenPelakuSatuTenant(
        pelaku({ departments: { name: "Global", tenantId: null } }),
        "tenant-a",
      ),
    ).toBeNull();
  });

  it("null bila pelaku tenant lain walau departemennya satu tenant dengan baris", () => {
    expect(
      departemenPelakuSatuTenant(pelaku({ tenantId: "tenant-b" }), "tenant-a"),
    ).toBeNull();
  });

  it("null bila pelaku tanpa departemen atau tanpa join", () => {
    expect(
      departemenPelakuSatuTenant(pelaku({ departments: null }), "tenant-a"),
    ).toBeNull();
    expect(departemenPelakuSatuTenant(null, "tenant-a")).toBeNull();
  });
});

describe("IS_SALES_PER_PERAN", () => {
  it("SALES berarti isSales true, NON_SALES berarti false", () => {
    expect(IS_SALES_PER_PERAN).toEqual({ SALES: true, NON_SALES: false });
  });
});
