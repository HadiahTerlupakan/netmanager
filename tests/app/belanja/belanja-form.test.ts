import { describe, expect, it } from "vitest";

import {
  buildBelanjaSubmitInput,
  buildInitialBelanjaForm,
  findBelanjaFormProblems,
  formatStoreDate,
  mergeBelanjaFormLines,
  readLinkToken,
  type BelanjaForm,
  type BelanjaItem,
  type BelanjaList,
} from "@/app/belanja/belanjaForm";

const TOKEN = "A".repeat(40) + "_-9";
const NOW = new Date(2026, 10, 9, 6, 30);

function makeItem(overrides: Partial<BelanjaItem> = {}): BelanjaItem {
  return {
    purchaseOrderItemId: "poi-1",
    name: "Kabel Fiber",
    unit: "roll",
    needed: 10,
    purchased: 4,
    remaining: 6,
    stores: [],
    ...overrides,
  };
}

function makeList(items: BelanjaItem[] = [makeItem()]): BelanjaList {
  return {
    state: "ACTIVE",
    requestNumber: "PR-001",
    warehouseName: "Gudang Utama",
    validUntil: "2026-12-09T00:00:00.000Z",
    items,
  };
}

function makeFilledForm(overrides: Partial<BelanjaForm> = {}): BelanjaForm {
  const form = buildInitialBelanjaForm(makeList(), "Andi", NOW);
  return {
    ...form,
    notes: "Bayar tunai",
    lines: form.lines.map((line) => ({ ...line, isChecked: true })),
    ...overrides,
  };
}

describe("readLinkToken", () => {
  it("menerima token 43 karakter dari fragmen URL", () => {
    expect(readLinkToken(`#${TOKEN}`)).toBe(TOKEN);
    expect(readLinkToken(TOKEN)).toBe(TOKEN);
  });

  it("menolak fragmen kosong atau bentuk yang salah", () => {
    expect(readLinkToken("")).toBeNull();
    expect(readLinkToken("#")).toBeNull();
    expect(readLinkToken(`#${TOKEN}x`)).toBeNull();
    expect(readLinkToken(`#${TOKEN.slice(1)}=`)).toBeNull();
  });
});

describe("buildInitialBelanjaForm", () => {
  it("mengisi jumlah dengan sisa, tanggal lokal hari ini, dan nama yang diingat", () => {
    const form = buildInitialBelanjaForm(makeList(), "Andi", NOW);
    expect(form).toEqual({
      purchasedAt: "2026-11-09",
      notes: "",
      buyerName: "Andi",
      lines: [
        {
          purchaseOrderItemId: "poi-1",
          isChecked: false,
          quantity: 6,
          unitPrice: "",
        },
      ],
    });
  });
});

describe("findBelanjaFormProblems", () => {
  it("lolos untuk isian lengkap", () => {
    expect(
      findBelanjaFormProblems(makeFilledForm(), [makeItem()], true, NOW),
    ).toEqual([]);
  });

  it("memakai pesan persis untuk isian yang kosong", () => {
    const form = buildInitialBelanjaForm(makeList(), "", NOW);
    expect(findBelanjaFormProblems(form, [makeItem()], false, NOW)).toEqual([
      "Centang dulu barang yang Anda beli.",
      "Isi nama Anda.",
      "Tanda tangan dulu di kotak tanda tangan.",
    ]);
  });

  it("membatasi jumlah antara 1 dan sisa", () => {
    const tooMany = makeFilledForm();
    tooMany.lines[0].quantity = 7;
    expect(findBelanjaFormProblems(tooMany, [makeItem()], true, NOW)).toEqual([
      "Jumlah Kabel Fiber paling banyak 6.",
    ]);

    const empty = makeFilledForm();
    empty.lines[0].quantity = 0;
    expect(findBelanjaFormProblems(empty, [makeItem()], true, NOW)).toEqual([
      "Jumlah Kabel Fiber minimal 1.",
    ]);
  });

  it("menolak harga yang tidak terbaca dan tanggal setelah hari ini", () => {
    const form = makeFilledForm({ purchasedAt: "2026-11-10" });
    form.lines[0].unitPrice = "12,5";
    expect(findBelanjaFormProblems(form, [makeItem()], true, NOW)).toEqual([
      "Harga Kabel Fiber tidak terbaca. Tulis angka saja, contoh 12000.",
      "Tanggal belanja tidak boleh setelah hari ini.",
    ]);
  });
});

describe("buildBelanjaSubmitInput", () => {
  it("mengirim barang yang dicentang saja dengan isian yang dirapikan", () => {
    const form = buildInitialBelanjaForm(
      makeList([
        makeItem(),
        makeItem({ purchaseOrderItemId: "poi-2", name: "ONT", remaining: 2 }),
      ]),
      "  Andi   Saputra ",
      NOW,
    );
    form.notes = "   ";
    form.lines[0] = {
      ...form.lines[0],
      isChecked: true,
      unitPrice: "Rp 12.000",
    };

    expect(buildBelanjaSubmitInput(form, "data:image/png;base64,AAA")).toEqual({
      buyerName: "Andi Saputra",
      purchasedAt: "2026-11-09",
      notes: null,
      signatureDataUrl: "data:image/png;base64,AAA",
      items: [{ purchaseOrderItemId: "poi-1", quantity: 6, unitPrice: 12000 }],
    });
  });
});

describe("mergeBelanjaFormLines", () => {
  it("mempertahankan isian yang diketik dan mengosongkan barang yang sudah habis", () => {
    const form = makeFilledForm();
    form.lines[0].quantity = 5;
    const merged = mergeBelanjaFormLines(
      form,
      makeList([
        makeItem({ remaining: 3 }),
        makeItem({ purchaseOrderItemId: "poi-2", name: "ONT", remaining: 0 }),
      ]),
    );
    expect(merged.notes).toBe("Bayar tunai");
    expect(merged.lines).toEqual([
      {
        purchaseOrderItemId: "poi-1",
        isChecked: true,
        quantity: 5,
        unitPrice: "",
      },
      {
        purchaseOrderItemId: "poi-2",
        isChecked: false,
        quantity: 0,
        unitPrice: "",
      },
    ]);
  });
});

describe("formatStoreDate", () => {
  it("menampilkan tanggal tanpa bergeser zona waktu", () => {
    expect(formatStoreDate("2026-11-09")).toMatch(/^09 Nov 2026$/);
    expect(formatStoreDate("bukan-tanggal")).toBe("bukan-tanggal");
  });
});
