import { describe, expect, it } from "vitest";

import {
  opnameBatchSchema,
  opnameItemSchema,
} from "@/modules/inventory/validators/opnameValidator";

describe("opnameItemSchema", () => {
  const baseValidInput = {
    barangId: "brg-001",
    gudangId: "gdg-001",
    stokFisik: 10,
  };

  it("accepts a minimal valid payload", () => {
    const result = opnameItemSchema.safeParse(baseValidInput);
    expect(result.success).toBe(true);
  });

  it("rejects when barangId is empty", () => {
    const result = opnameItemSchema.safeParse({
      ...baseValidInput,
      barangId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when stokFisik is negative", () => {
    const result = opnameItemSchema.safeParse({
      ...baseValidInput,
      stokFisik: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when stokFisik is not integer", () => {
    const result = opnameItemSchema.safeParse({
      ...baseValidInput,
      stokFisik: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when total kondisi exceeds stokFisik", () => {
    const result = opnameItemSchema.safeParse({
      ...baseValidInput,
      stokFisik: 5,
      kondisiBaik: 4,
      kondisiRusak: 2,
      kondisiExpire: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const stokFisikIssue = result.error.issues.find((issue) =>
        issue.path.includes("stokFisik"),
      );
      expect(stokFisikIssue).toBeDefined();
    }
  });

  it("accepts when total kondisi equals stokFisik", () => {
    const result = opnameItemSchema.safeParse({
      ...baseValidInput,
      stokFisik: 6,
      kondisiBaik: 4,
      kondisiRusak: 1,
      kondisiExpire: 1,
    });
    expect(result.success).toBe(true);
  });

  it("normalizes empty alasanSelisih to undefined", () => {
    const result = opnameItemSchema.safeParse({
      ...baseValidInput,
      alasanSelisih: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alasanSelisih).toBeUndefined();
    }
  });

  it("rejects unknown alasanSelisih code", () => {
    const result = opnameItemSchema.safeParse({
      ...baseValidInput,
      alasanSelisih: "tidak_dikenal",
    });
    expect(result.success).toBe(false);
  });

  it("accepts known alasanSelisih codes", () => {
    const codes = [
      "hilang",
      "rusak",
      "revisi",
      "salah_input",
      "terpakai",
      "expired",
      "lebih",
      "lainnya",
    ] as const;

    for (const code of codes) {
      const result = opnameItemSchema.safeParse({
        ...baseValidInput,
        alasanSelisih: code,
      });
      expect(result.success, `code=${code}`).toBe(true);
    }
  });

  it("normalizes empty optional strings to undefined", () => {
    const result = opnameItemSchema.safeParse({
      ...baseValidInput,
      keterangan: "",
      lokasiPenyimpanan: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keterangan).toBeUndefined();
      expect(result.data.lokasiPenyimpanan).toBeUndefined();
    }
  });
});

describe("opnameBatchSchema", () => {
  it("requires gudangId at root", () => {
    const result = opnameBatchSchema.safeParse({
      gudangId: "",
      items: [{ barangId: "brg-001", stokFisik: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one item", () => {
    const result = opnameBatchSchema.safeParse({
      gudangId: "gdg-001",
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("does not require gudangId per item", () => {
    const result = opnameBatchSchema.safeParse({
      gudangId: "gdg-001",
      items: [
        { barangId: "brg-001", stokFisik: 5 },
        { barangId: "brg-002", stokFisik: 10, kondisiBaik: 8, kondisiRusak: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("propagates per-item validation errors", () => {
    const result = opnameBatchSchema.safeParse({
      gudangId: "gdg-001",
      items: [{ barangId: "brg-001", stokFisik: 3, kondisiBaik: 5 }],
    });
    expect(result.success).toBe(false);
  });
});
