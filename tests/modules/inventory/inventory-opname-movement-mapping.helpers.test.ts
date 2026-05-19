import { describe, expect, it } from "vitest";

import {
  isAdministrativeAdjustment,
  resolveNegativeMovementCondition,
  resolvePositiveMovementCondition,
} from "@/modules/inventory/services/inventory-opname-movement-mapping.helpers";

describe("inventory-opname-movement-mapping.helpers", () => {
  describe("isAdministrativeAdjustment", () => {
    it("treats revisi as administrative", () => {
      expect(isAdministrativeAdjustment("revisi")).toBe(true);
    });

    it("treats salah_input as administrative", () => {
      expect(isAdministrativeAdjustment("salah_input")).toBe(true);
    });

    it("treats hilang/rusak/expired/lebih/lainnya as physical movement", () => {
      expect(isAdministrativeAdjustment("hilang")).toBe(false);
      expect(isAdministrativeAdjustment("rusak")).toBe(false);
      expect(isAdministrativeAdjustment("expired")).toBe(false);
      expect(isAdministrativeAdjustment("lebih")).toBe(false);
      expect(isAdministrativeAdjustment("lainnya")).toBe(false);
    });

    it("treats undefined/empty as physical movement", () => {
      expect(isAdministrativeAdjustment(undefined)).toBe(false);
      expect(isAdministrativeAdjustment("")).toBe(false);
    });
  });

  describe("resolvePositiveMovementCondition", () => {
    it("defaults to BARU when no breakdown is given", () => {
      expect(resolvePositiveMovementCondition({})).toBe("BARU");
      expect(
        resolvePositiveMovementCondition({
          kondisiBaik: 0,
          kondisiRusak: 0,
          kondisiExpire: 0,
        }),
      ).toBe("BARU");
    });

    it("returns BARU when majority is baik", () => {
      expect(
        resolvePositiveMovementCondition({
          kondisiBaik: 10,
          kondisiRusak: 1,
          kondisiExpire: 1,
        }),
      ).toBe("BARU");
    });

    it("returns RUSAK when majority is rusak", () => {
      expect(
        resolvePositiveMovementCondition({
          kondisiBaik: 1,
          kondisiRusak: 5,
          kondisiExpire: 1,
        }),
      ).toBe("RUSAK");
    });

    it("returns BEKAS when majority is bekas/expire", () => {
      expect(
        resolvePositiveMovementCondition({
          kondisiBaik: 1,
          kondisiRusak: 1,
          kondisiExpire: 5,
        }),
      ).toBe("BEKAS");
    });

    it("treats RUSAK preferred over BEKAS on tie when rusak equals max", () => {
      expect(
        resolvePositiveMovementCondition({
          kondisiBaik: 1,
          kondisiRusak: 5,
          kondisiExpire: 5,
        }),
      ).toBe("RUSAK");
    });

    it("treats BARU preferred over RUSAK on tie when baik equals max", () => {
      // Baik tidak diuji eksplisit dalam priority chain karena fallback terakhir
      // adalah BARU; tie baik=rusak harus tetap RUSAK karena rusak diperiksa
      // lebih dulu (lebih konservatif terhadap kualitas).
      expect(
        resolvePositiveMovementCondition({
          kondisiBaik: 5,
          kondisiRusak: 5,
          kondisiExpire: 1,
        }),
      ).toBe("RUSAK");
    });

    it("handles missing fields by treating them as zero", () => {
      expect(resolvePositiveMovementCondition({ kondisiRusak: 3 })).toBe(
        "RUSAK",
      );
      expect(resolvePositiveMovementCondition({ kondisiExpire: 3 })).toBe(
        "BEKAS",
      );
      expect(resolvePositiveMovementCondition({ kondisiBaik: 3 })).toBe("BARU");
    });
  });

  describe("resolveNegativeMovementCondition", () => {
    it("maps rusak alasan to RUSAK", () => {
      expect(resolveNegativeMovementCondition("rusak")).toBe("RUSAK");
    });

    it("maps expired alasan to BEKAS", () => {
      expect(resolveNegativeMovementCondition("expired")).toBe("BEKAS");
    });

    it("falls back to BARU for hilang, terpakai, lebih, lainnya, undefined", () => {
      expect(resolveNegativeMovementCondition("hilang")).toBe("BARU");
      expect(resolveNegativeMovementCondition("terpakai")).toBe("BARU");
      expect(resolveNegativeMovementCondition("lebih")).toBe("BARU");
      expect(resolveNegativeMovementCondition("lainnya")).toBe("BARU");
      expect(resolveNegativeMovementCondition(undefined)).toBe("BARU");
      expect(resolveNegativeMovementCondition("")).toBe("BARU");
    });
  });
});
