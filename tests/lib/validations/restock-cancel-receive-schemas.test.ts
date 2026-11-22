import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

import {
  describeRestockValidationError,
  RESTOCK_CANCEL_REASON_LIMITS,
  restockCancelSchema,
  restockLifecycleSchema,
  restockReceiveSchema,
  type RestockLifecycleInput,
} from "@/lib/validations/restock";

const MUAT_ULANG =
  "Tindakan ini sudah tidak tersedia. Muat ulang halaman, lalu coba lagi.";
const BODY_TIDAK_TERBACA =
  "Data yang dikirim tidak terbaca. Muat ulang halaman, lalu coba lagi.";
const FOTO_TIDAK_TERBACA =
  "Foto bukti tidak terbaca. Unggah ulang fotonya, lalu simpan.";
const ALASAN_KURANG = "Tulis alasan pembatalan, paling sedikit 5 huruf.";
const ALASAN_KEPANJANGAN =
  "Alasan pembatalan terlalu panjang. Paling banyak 255 huruf.";
const TINDAKAN_TIDAK_DIKENAL =
  "Tindakan ini tidak dikenal. Pilih Setujui atau Tolak, lalu coba lagi.";

const APPROVE_BODY: RestockLifecycleInput = {
  action: "APPROVE",
  catatan: "Oke",
  items: [{ itemId: "item-1", keputusan: "APPROVED", jumlah: 2 }],
  jasaItems: [],
};
const REJECT_BODY: RestockLifecycleInput = {
  action: "REJECT",
  catatan: "Stok masih ada",
};

/** Pesan yang dilihat petugas untuk body ini; kosong bila body lolos. */
function problemsOf(schema: ZodType, body: unknown): string {
  const parsed = schema.safeParse(body);
  if (parsed.success) return "";
  return describeRestockValidationError(parsed.error);
}

describe("restockCancelSchema: Batalkan Pengajuan", () => {
  const validBody = {
    action: "CANCEL",
    alasan: "Barangnya sudah tidak dibutuhkan",
  };

  it("menerima pembatalan dengan alasan", () => {
    expect(restockCancelSchema.parse(validBody)).toEqual(validBody);
  });

  it("merapikan spasi di awal dan akhir alasan", () => {
    expect(
      restockCancelSchema.parse({ ...validBody, alasan: "  Salah gudang  " }),
    ).toEqual({ action: "CANCEL", alasan: "Salah gudang" });
  });

  it("batas alasan 5 sampai 255 huruf", () => {
    expect(RESTOCK_CANCEL_REASON_LIMITS).toEqual({ min: 5, max: 255 });
  });

  it.each<[string, string]>([
    ["tepat batas bawah", "a".repeat(5)],
    ["tepat batas atas", "a".repeat(255)],
    ["tepat batas atas setelah spasi dirapikan", `  ${"a".repeat(255)}  `],
  ])("menerima alasan %s", (_label, alasan) => {
    expect(
      restockCancelSchema.safeParse({ ...validBody, alasan }).success,
    ).toBe(true);
  });

  it.each(["", "abcd", "   abc   ", "     "])(
    "menolak alasan %j yang kurang dari 5 huruf setelah dirapikan",
    (alasan) => {
      expect(problemsOf(restockCancelSchema, { ...validBody, alasan })).toBe(
        ALASAN_KURANG,
      );
    },
  );

  it.each<[string, unknown]>([
    ["tidak dikirim", { action: "CANCEL" }],
    ["null", { action: "CANCEL", alasan: null }],
    ["bukan teks", { action: "CANCEL", alasan: 12345 }],
  ])("alasan %s → diminta menulis alasan", (_label, body) => {
    expect(problemsOf(restockCancelSchema, body)).toBe(ALASAN_KURANG);
  });

  it("menolak alasan lebih dari 255 huruf", () => {
    expect(
      problemsOf(restockCancelSchema, {
        ...validBody,
        alasan: "a".repeat(256),
      }),
    ).toBe(ALASAN_KEPANJANGAN);
  });

  it("field tambahan berarti kiriman rusak → pesan muat ulang", () => {
    expect(
      problemsOf(restockCancelSchema, { ...validBody, catatan: "lain" }),
    ).toBe(BODY_TIDAK_TERBACA);
  });

  it.each<[string, unknown]>([
    ["daftar", ["CANCEL"]],
    ["teks", "CANCEL"],
    ["null", null],
  ])("body berupa %s tidak terbaca", (_label, body) => {
    expect(problemsOf(restockCancelSchema, body)).toBe(BODY_TIDAK_TERBACA);
  });
});

describe("PATCH pengajuan: Batalkan terpisah dari Setujui/Tolak", () => {
  it.each<[string, unknown]>([
    ["Setujui", APPROVE_BODY],
    ["Tolak", REJECT_BODY],
  ])("skema persetujuan tetap menerima %s", (_label, body) => {
    expect(restockLifecycleSchema.safeParse(body).success).toBe(true);
  });

  it.each<[string, unknown]>([
    ["Setujui", APPROVE_BODY],
    ["Tolak", REJECT_BODY],
  ])("skema batal tidak menerima %s", (_label, body) => {
    expect(restockCancelSchema.safeParse(body).success).toBe(false);
  });

  it("skema persetujuan tidak mengenal CANCEL, jadi route memilih skema dari action", () => {
    expect(
      problemsOf(restockLifecycleSchema, {
        action: "CANCEL",
        alasan: "Barangnya sudah tidak dibutuhkan",
      }),
    ).toBe(TINDAKAN_TIDAK_DIKENAL);
  });
});

describe("restockReceiveSchema: Lapor Barang Sampai", () => {
  const validBody = {
    items: { "barang-1": 8, "barang-2": 0 },
    substitutions: { "barang-1": "barang-pengganti" },
    overReceipts: { "barang-3": "Supplier mengirim bonus" },
    fotoBukti: ["https://cdn.example.test/bukti-1.jpg"],
  };

  it("menerima body lengkap apa adanya", () => {
    expect(restockReceiveSchema.parse(validBody)).toEqual(validBody);
  });

  it("pengganti, alasan kelebihan, dan foto boleh tidak dikirim", () => {
    expect(restockReceiveSchema.parse({ items: { "barang-1": 0 } })).toEqual({
      items: { "barang-1": 0 },
      substitutions: {},
      overReceipts: {},
      fotoBukti: [],
    });
  });

  it("nilai bawaan tidak dipakai bersama antar-permintaan", () => {
    const first = restockReceiveSchema.parse({ items: {} });
    first.substitutions["barang-1"] = "barang-2";
    first.fotoBukti.push("foto.jpg");

    expect(restockReceiveSchema.parse({ items: {} })).toMatchObject({
      substitutions: {},
      fotoBukti: [],
    });
  });

  it.each<[string, unknown, string]>([
    ["minus", -1, "Jumlah barang yang sampai tidak boleh minus."],
    [
      "berkoma",
      1.5,
      "Jumlah barang yang sampai harus angka bulat, tanpa koma.",
    ],
    ["teks", "5", "Jumlah barang yang sampai harus diisi angka."],
    ["kosong", null, "Jumlah barang yang sampai harus diisi angka."],
  ])("menolak jumlah %s", (_label, quantity, message) => {
    expect(
      problemsOf(restockReceiveSchema, {
        ...validBody,
        items: { "barang-1": quantity },
      }),
    ).toBe(message);
  });

  it.each<[string, unknown]>([
    ["tidak dikirim", undefined],
    ["berupa daftar", [8]],
  ])("menolak daftar jumlah yang %s", (_label, items) => {
    expect(problemsOf(restockReceiveSchema, { ...validBody, items })).toBe(
      BODY_TIDAK_TERBACA,
    );
  });

  it.each<[string, Record<string, unknown>]>([
    ["pengganti bukan teks", { substitutions: { "barang-1": 7 } }],
    ["daftar pengganti bukan objek", { substitutions: "barang-2" }],
    ["alasan kelebihan bukan teks", { overReceipts: { "barang-1": true } }],
  ])("menolak %s", (_label, override) => {
    expect(
      problemsOf(restockReceiveSchema, { ...validBody, ...override }),
    ).toBe(BODY_TIDAK_TERBACA);
  });

  it.each<[string, unknown]>([
    ["bukan daftar", "foto.jpg"],
    ["berisi teks kosong", [""]],
    ["berisi bukan teks", [42]],
  ])("menolak foto bukti yang %s", (_label, fotoBukti) => {
    expect(problemsOf(restockReceiveSchema, { ...validBody, fotoBukti })).toBe(
      FOTO_TIDAK_TERBACA,
    );
  });

  it.each<[string, Record<string, unknown>]>([
    [
      "simpan dengan sisa masih ditunggu",
      { cancellations: {}, closePO: false },
    ],
    [
      "selesaikan pesanan dengan alasan sisa tidak datang",
      { cancellations: { "barang-2": "Stok supplier habis" }, closePO: true },
    ],
    ["hanya closePO", { closePO: true }],
  ])("body lama (%s) → hanya pesan muat ulang", (_label, legacyFields) => {
    expect(
      problemsOf(restockReceiveSchema, { ...validBody, ...legacyFields }),
    ).toBe(MUAT_ULANG);
  });

  it("body lama tutup sisa yang belum dibeli → hanya pesan muat ulang", () => {
    expect(
      problemsOf(restockReceiveSchema, {
        items: {},
        closeUnpurchased: true,
        closeReason: "Barang tidak jadi dibeli",
      }),
    ).toBe(MUAT_ULANG);
  });

  it("body yang bukan objek tidak terbaca", () => {
    expect(problemsOf(restockReceiveSchema, "items")).toBe(BODY_TIDAK_TERBACA);
  });
});
