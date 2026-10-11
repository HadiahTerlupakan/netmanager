import { describe, it, expect } from "vitest";

import {
  buatTitikRencanaSchema,
  buatJalurRencanaSchema,
  ubahCadanganKabelSchema,
} from "@/modules/planning/validators/planningPetaSchemas";

const titikDasar = {
  type: "odp" as const,
  name: "ODP-01",
  latitude: -6.2,
  longitude: 106.8,
  splitter: "1:8",
};

describe("buatTitikRencanaSchema", () => {
  it("menerima titik dengan rasio yang sah", () => {
    expect(buatTitikRencanaSchema.safeParse(titikDasar).success).toBe(true);
  });

  it("menolak titik tanpa rasio splitter (tidak ada nilai bawaan)", () => {
    const { splitter: _splitter, ...tanpaRasio } = titikDasar;
    expect(buatTitikRencanaSchema.safeParse(tanpaRasio).success).toBe(false);
  });

  it("menolak rasio kosong", () => {
    expect(
      buatTitikRencanaSchema.safeParse({ ...titikDasar, splitter: "" }).success,
    ).toBe(false);
  });

  it("menerima 1:64 untuk ODC tetapi menolaknya untuk ODP", () => {
    expect(
      buatTitikRencanaSchema.safeParse({
        ...titikDasar,
        type: "odc",
        splitter: "1:64",
      }).success,
    ).toBe(true);
    expect(
      buatTitikRencanaSchema.safeParse({ ...titikDasar, splitter: "1:64" })
        .success,
    ).toBe(false);
  });

  it("menolak koordinat di luar rentang", () => {
    expect(
      buatTitikRencanaSchema.safeParse({ ...titikDasar, latitude: 91 }).success,
    ).toBe(false);
    expect(
      buatTitikRencanaSchema.safeParse({ ...titikDasar, longitude: -181 })
        .success,
    ).toBe(false);
  });
});

describe("buatJalurRencanaSchema", () => {
  it("memberi waypoints kosong bila tidak dikirim", () => {
    const hasil = buatJalurRencanaSchema.parse({
      source: "a",
      target: "b",
      fiberType: "24 core",
    });
    expect(hasil.waypoints).toEqual([]);
  });

  it("menolak jarak negatif dan waypoint di luar rentang", () => {
    const dasar = { source: "a", target: "b", fiberType: "24 core" };
    expect(
      buatJalurRencanaSchema.safeParse({ ...dasar, distance: -1 }).success,
    ).toBe(false);
    expect(
      buatJalurRencanaSchema.safeParse({ ...dasar, waypoints: [[95, 0]] })
        .success,
    ).toBe(false);
  });
});

describe("ubahCadanganKabelSchema", () => {
  it("menerima 0 sampai 100 dan menolak di luar itu", () => {
    expect(
      ubahCadanganKabelSchema.safeParse({ spareKabelPersen: 0 }).success,
    ).toBe(true);
    expect(
      ubahCadanganKabelSchema.safeParse({ spareKabelPersen: 100 }).success,
    ).toBe(true);
    expect(
      ubahCadanganKabelSchema.safeParse({ spareKabelPersen: -1 }).success,
    ).toBe(false);
    expect(
      ubahCadanganKabelSchema.safeParse({ spareKabelPersen: 101 }).success,
    ).toBe(false);
  });
});
