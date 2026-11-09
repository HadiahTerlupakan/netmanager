import { describe, expect, it } from "vitest";

import {
  publicPurchaseListSchema,
  publicPurchaseRecordSchema,
  restockPurchaseRecordSchema,
} from "@/lib/validations/restock";

const TOKEN = "A".repeat(43);
const valid = {
  token: TOKEN,
  clientRequestId: "6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
  buyerName: "  Pak   Joko ",
  storeName: "Toko Sinar",
  purchasedAt: "2026-11-09",
  notes: null as string | null,
  signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  items: [{ purchaseOrderItemId: "poi-1", quantity: 2 }],
};

function messages(result: {
  success: boolean;
  error?: { issues: Array<{ message: string }> };
}) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("publicPurchaseRecordSchema", () => {
  it.each([
    ["buyerName", "Budi\u202Eodnaw"],
    ["buyerName", "Bu\u200Bdi"],
    ["storeName", "Toko\u202DSinar"],
    ["storeName", "Toko\nSinar"],
    ["notes", "lunas\u2066x"],
  ])("menolak karakter format/pembalik arah di %s", (field, value) => {
    expect(
      publicPurchaseRecordSchema.safeParse({ ...valid, [field]: value })
        .success,
    ).toBe(false);
  });

  it("catatan boleh beberapa baris", () => {
    const result = publicPurchaseRecordSchema.safeParse({
      ...valid,
      notes: "baris satu\nbaris dua",
    });

    expect(result.success).toBe(true);
  });

  it("menerima isian sah dan merapikan nama", () => {
    const result = publicPurchaseRecordSchema.safeParse(valid);

    expect(result.success).toBe(true);
    expect(result.data?.buyerName).toBe("Pak Joko");
  });

  it.each([
    ["supplierId", "sup-1"],
    ["fotoNota", ["https://x/foto.jpg"]],
  ])("strict: menolak field %s", (field, value) => {
    expect(
      publicPurchaseRecordSchema.safeParse({ ...valid, [field]: value })
        .success,
    ).toBe(false);
  });

  it("clientRequestId wajib UUID", () => {
    expect(
      publicPurchaseRecordSchema.safeParse({ ...valid, clientRequestId: "x" })
        .success,
    ).toBe(false);
  });

  it("nama wajib dan karakter kontrol ditolak", () => {
    expect(
      messages(
        publicPurchaseRecordSchema.safeParse({ ...valid, buyerName: " " }),
      ),
    ).toContain("Isi nama Anda.");
    expect(
      messages(
        publicPurchaseRecordSchema.safeParse({
          ...valid,
          buyerName: "Jo\u0000ko",
        }),
      ),
    ).toContain("Nama berisi huruf yang tidak bisa dipakai.");
  });

  it("barang dobel ditolak", () => {
    const result = publicPurchaseRecordSchema.safeParse({
      ...valid,
      items: [
        { purchaseOrderItemId: "poi-1", quantity: 1 },
        { purchaseOrderItemId: "poi-1", quantity: 1 },
      ],
    });
    expect(messages(result)).toContain(
      "Barang ini tercantum dua kali. Hapus salah satunya.",
    );
  });

  it("tanda tangan wajib PNG dan dibatasi panjangnya", () => {
    expect(
      messages(
        publicPurchaseRecordSchema.safeParse({
          ...valid,
          signatureDataUrl: "data:image/jpeg;base64,AAAA",
        }),
      ),
    ).toContain("Tanda tangan dulu di kotak tanda tangan.");
    expect(
      messages(
        publicPurchaseRecordSchema.safeParse({
          ...valid,
          signatureDataUrl: `data:image/png;base64,${"A".repeat(280_000)}`,
        }),
      ),
    ).toContain("Tanda tangan terlalu besar. Hapus, lalu tanda tangan ulang.");
  });

  it("token salah bentuk ditolak", () => {
    expect(
      publicPurchaseRecordSchema.safeParse({ ...valid, token: "pendek" })
        .success,
    ).toBe(false);
  });
});

describe("publicPurchaseListSchema", () => {
  it("hanya menerima token", () => {
    expect(publicPurchaseListSchema.safeParse({ token: TOKEN }).success).toBe(
      true,
    );
    expect(
      publicPurchaseListSchema.safeParse({ token: TOKEN, lain: 1 }).success,
    ).toBe(false);
  });
});

describe("restockPurchaseRecordSchema.buyerName (admin)", () => {
  const admin = {
    storeName: "Toko",
    purchasedAt: "2026-11-09",
    items: [{ purchaseOrderItemId: "poi-1", quantity: 1 }],
  };

  it.each([
    [undefined, undefined],
    [null, null],
    ["   ", null],
    [" Pak  Joko ", "Pak Joko"],
  ])("%j → %j", (input, expected) => {
    const result = restockPurchaseRecordSchema.safeParse({
      ...admin,
      buyerName: input,
    });
    expect(result.success).toBe(true);
    expect(result.data?.buyerName).toBe(expected);
  });
});

it("field asing dijawab dengan pesan awam", () => {
  const result = publicPurchaseRecordSchema.safeParse({ ...valid, lain: 1 });
  expect(messages(result)).toEqual([
    "Isian tidak terbaca. Muat ulang halaman, lalu coba lagi.",
  ]);
});
