import { describe, expect, it } from "vitest";

import { buildMapWhere } from "@/modules/map/utils/tenantContext";

const TENANT = { tenantId: "tenant-1", isSuperAdmin: false };
const SUPERADMIN = { tenantId: null as string | null, isSuperAdmin: true };

describe("buildMapWhere — penyaring node rencana", () => {
  it("menyembunyikan node rencana secara bawaan", () => {
    expect(buildMapWhere(TENANT)).toMatchObject({
      tenantId: "tenant-1",
      isPlanned: false,
    });
  });

  it("tetap menyembunyikan node rencana untuk superadmin tanpa filter", () => {
    // Cabang ini dulu mengembalikan undefined sehingga tidak ada penyaring
    // sama sekali — superadmin akan melihat seluruh titik rencana di peta
    // operasional.
    expect(buildMapWhere(SUPERADMIN)).toEqual({ isPlanned: false });
  });

  it("menyembunyikan node rencana walau ada filter lain", () => {
    expect(buildMapWhere(TENANT, { type: "odp" })).toMatchObject({
      type: "odp",
      isPlanned: false,
    });
  });

  it("menampilkan hanya node rencana saat lingkup diminta eksplisit", () => {
    expect(buildMapWhere(TENANT, { lingkup: "rencana" })).toMatchObject({
      isPlanned: true,
    });
  });

  it("tidak membatasi isPlanned saat lingkup semua", () => {
    expect(buildMapWhere(TENANT, { lingkup: "semua" })).not.toHaveProperty(
      "isPlanned",
    );
  });
});
