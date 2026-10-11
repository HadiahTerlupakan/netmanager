import { describe, expect, it } from "vitest";

import { hitungKebutuhanMaterialOsp } from "@/modules/planning/domain/kebutuhan-material-osp";

const TITIK_NOL = { latitude: 0, longitude: 0 };

function jalur(fiberType: string, distance: number | null) {
  return {
    fiberType,
    distance,
    sumber: TITIK_NOL,
    tujuan: TITIK_NOL,
    waypoints: [] as Array<[number, number]>,
  };
}

describe("hitungKebutuhanMaterialOsp", () => {
  it("menjumlahkan panjang kabel per jenis fiber", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [],
      [jalur("feeder", 300), jalur("feeder", 240), jalur("distribution", 120)],
      0,
    );

    expect(hasil.kabel).toEqual([
      { jenisFiber: "feeder", meterTerukur: 540, meterDipesan: 540 },
      { jenisFiber: "distribution", meterTerukur: 120, meterDipesan: 120 },
    ]);
  });

  it("cadangan 0 persen tidak mengubah angka sama sekali", () => {
    const hasil = hitungKebutuhanMaterialOsp([], [jalur("feeder", 333.3)], 0);

    expect(hasil.kabel[0].meterDipesan).toBe(hasil.kabel[0].meterTerukur);
  });

  it("menerapkan cadangan sekali di akhir, bukan per ruas", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [],
      [jalur("feeder", 100), jalur("feeder", 100)],
      10,
    );

    expect(hasil.kabel[0].meterTerukur).toBe(200);
    expect(hasil.kabel[0].meterDipesan).toBe(220);
  });

  it("membulatkan meter pesanan ke 0,1 agar bisa dipesan", () => {
    const hasil = hitungKebutuhanMaterialOsp([], [jalur("feeder", 333)], 7);

    expect(hasil.kabel[0].meterDipesan).toBe(356.3);
  });

  it("menolak cadangan negatif", () => {
    expect(() => hitungKebutuhanMaterialOsp([], [], -1)).toThrow(
      /cadangan kabel/i,
    );
  });

  it("menolak cadangan di atas 100 persen", () => {
    expect(() => hitungKebutuhanMaterialOsp([], [], 101)).toThrow(
      /cadangan kabel/i,
    );
  });

  it("menghitung jarak sendiri saat jalur belum punya distance", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [],
      [
        {
          fiberType: "feeder",
          distance: null,
          sumber: { latitude: -6.2, longitude: 106.8 },
          tujuan: { latitude: -6.201, longitude: 106.8 },
          waypoints: [],
        },
      ],
      0,
    );

    // ~111 m per 0,001 derajat lintang.
    expect(hasil.kabel[0].meterTerukur).toBeGreaterThan(100);
    expect(hasil.kabel[0].meterTerukur).toBeLessThan(125);
  });

  it("mengabaikan jalur tanpa distance dan tanpa koordinat lengkap", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [],
      [
        {
          fiberType: "feeder",
          distance: null,
          sumber: { latitude: null, longitude: null },
          tujuan: TITIK_NOL,
          waypoints: [],
        },
      ],
      0,
    );

    expect(hasil.kabel).toEqual([]);
  });

  it("mengelompokkan splitter per rasio", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [
        { type: "odp", splitter: "1:8" },
        { type: "odp", splitter: "1:8" },
        { type: "odc", splitter: "1:16" },
      ],
      [],
      0,
    );

    expect(hasil.splitter).toEqual([
      { rasio: "1:8", jumlah: 2 },
      { rasio: "1:16", jumlah: 1 },
    ]);
    expect(hasil.jumlahTitik).toEqual({ odp: 2, odc: 1 });
  });

  it("tidak mengarang rasio untuk titik yang splitternya kosong", () => {
    const hasil = hitungKebutuhanMaterialOsp(
      [{ type: "odp", splitter: null }],
      [],
      0,
    );

    expect(hasil.splitter).toEqual([]);
    expect(hasil.jumlahTitik.odp).toBe(1);
  });
});
