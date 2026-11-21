import { describe, expect, it } from "vitest";

import { restockReceiveSchema } from "@/lib/validations/restock";
import {
  buildRestockReceivePayload,
  clampEnteredQuantity,
  describeRestockReceiveLines,
  getNotEnteredQuantity,
  getRestockReceiveProblems,
  getRestockReceiveSubmitLabel,
  getRestockReceiveSuccessMessage,
  getRestockReceiveSummary,
  getRestockShortfallConfirmMessage,
  needsRestockShortfallConfirm,
  NOTHING_ENTERED_MESSAGE,
  OVER_RECEIPT_REASON_MISSING_MESSAGE,
  PHOTO_MISSING_MESSAGE,
  type RestockReceiveFormInput,
  type RestockReceivePayloadInput,
  type RestockReceiveProblemInput,
} from "@/app/admin/inventory/restock/restockReceiveForm";
import type {
  Barang,
  PurchaseRequest,
  PurchaseRequestItem,
} from "@/app/admin/inventory/restock/types";

function makeItem(
  overrides: Partial<PurchaseRequestItem> = {},
): PurchaseRequestItem {
  return {
    id: "item-1",
    barangId: "fiber",
    jumlah: 10,
    orderedQuantity: 10,
    receivedQuantity: 0,
    barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
    ...overrides,
  };
}

const ontItem = makeItem({
  id: "item-2",
  barangId: "ont",
  jumlah: 5,
  orderedQuantity: 5,
  barang: { nama: "ONT", kode: "BRG-2", satuan: "pcs" },
});
const konektorItem = makeItem({
  id: "item-3",
  barangId: "konektor",
  jumlah: 20,
  orderedQuantity: 20,
  barang: { nama: "Konektor", kode: "BRG-3", satuan: "pcs" },
});

function makeRequest(
  overrides: Partial<PurchaseRequest> = {},
): PurchaseRequest {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "ORDERED",
    createdAt: "2026-11-01T00:00:00.000Z",
    requester: { name: "Budi" },
    gudangId: "gudang-a",
    gudang: { id: "gudang-a", nama: "Gudang Utama" },
    purchaseOrder: { id: "po-1", poNumber: "PO-1", status: "DRAFT" },
    items: [makeItem(), ontItem],
    ...overrides,
  };
}

const patchCord: Barang = {
  id: "patch-cord",
  kode: "BRG-9",
  nama: "Patch Cord",
  satuan: "pcs",
};

function formInput(
  overrides: Partial<RestockReceiveFormInput> = {},
): RestockReceiveFormInput {
  return {
    request: makeRequest(),
    receivedItems: { fiber: 10, ont: 5 },
    substitutions: {},
    barangs: [patchCord],
    ...overrides,
  };
}

function problemsFor(
  overrides: Partial<RestockReceiveProblemInput> = {},
): string[] {
  return getRestockReceiveProblems({
    ...formInput(),
    overReceipts: {},
    photoCount: 1,
    ...overrides,
  });
}

function payloadFor(
  overrides: Partial<RestockReceivePayloadInput> = {},
): ReturnType<typeof buildRestockReceivePayload> {
  return buildRestockReceivePayload({
    ...formInput(),
    overReceipts: {},
    fotoBukti: ["https://cdn.radpro.id/bukti.webp"],
    ...overrides,
  });
}

describe("getRestockReceiveSummary", () => {
  it("memasukkan semua sisa bila isian sesuai yang disetujui", () => {
    const summary = getRestockReceiveSummary(formInput());

    expect(summary).toEqual({
      entering: [
        {
          barangId: "fiber",
          nama: "Kabel Fiber",
          satuan: "roll",
          quantity: 10,
        },
        { barangId: "ont", nama: "ONT", satuan: "pcs", quantity: 5 },
      ],
      notEntered: [],
      hasEntry: true,
      hasEnteredBefore: false,
    });
    expect(getRestockReceiveSubmitLabel(summary)).toBe("Simpan ke Gudang");
  });

  it("mencatat sisa yang diisi kurang sebagai tidak dimasukkan", () => {
    const summary = getRestockReceiveSummary(
      formInput({ receivedItems: { fiber: 6, ont: 5 } }),
    );

    expect(summary.notEntered).toEqual([
      { barangId: "fiber", nama: "Kabel Fiber", satuan: "roll", quantity: 4 },
    ]);
  });

  it("memakai nama barang pengganti untuk barang yang masuk", () => {
    const summary = getRestockReceiveSummary(
      formInput({
        receivedItems: { fiber: 4, ont: 5 },
        substitutions: { fiber: "patch-cord" },
      }),
    );

    expect(summary.entering[0]).toEqual({
      barangId: "fiber",
      nama: "Patch Cord",
      satuan: "pcs",
      quantity: 4,
    });
    // Yang tidak dimasukkan tetap barang yang diajukan.
    expect(summary.notEntered[0]?.nama).toBe("Kabel Fiber");
  });

  it("melewati baris yang ditolak atasan dan baris yang sudah habis sisanya", () => {
    const summary = getRestockReceiveSummary(
      formInput({
        request: makeRequest({
          items: [
            makeItem({ receivedQuantity: 10 }),
            { ...ontItem, statusApproval: "REJECTED" },
            konektorItem,
          ],
        }),
        receivedItems: { fiber: 3, ont: 5, konektor: 20 },
      }),
    );

    expect(summary.entering.map((line) => line.barangId)).toEqual(["konektor"]);
  });

  it("menghitung bagian patokan yang tidak dimasukkan, tidak pernah minus", () => {
    expect(getNotEnteredQuantity(10, 4)).toBe(6);
    expect(getNotEnteredQuantity(10, 12)).toBe(0);
  });
});

describe("patokan Masukkan Barang = yang ditutup server", () => {
  /** Pesanan milik satu pengajuan yang jumlahnya dinaikkan lewat Ubah isi PO. */
  function raisedOrderInput(fiberEntered: number): RestockReceiveFormInput {
    return formInput({
      request: makeRequest({
        items: [makeItem({ orderedQuantity: 15 })],
      }),
      receivedItems: { fiber: fiberEntered },
    });
  }

  /** Pesanan gabungan: satu item Kabel 10 roll untuk dua pengajuan 5 + 5. */
  function mergedOrderInput(fiberEntered: number): RestockReceiveFormInput {
    return formInput({
      request: makeRequest({
        purchaseOrder: {
          id: "po-1",
          poNumber: "PO-1",
          status: "ORDERED",
          linkedRequestCount: 2,
        },
        items: [makeItem({ jumlah: 5, orderedQuantity: 10 })],
      }),
      receivedItems: { fiber: fiberEntered },
    });
  }

  it("pesanan milik satu pengajuan: seluruh sisa pesanan yang tidak diisi ikut tidak dimasukkan", () => {
    const summary = getRestockReceiveSummary(raisedOrderInput(10));

    expect(summary.notEntered).toEqual([
      { barangId: "fiber", nama: "Kabel Fiber", satuan: "roll", quantity: 5 },
    ]);
    expect(needsRestockShortfallConfirm(summary)).toBe(true);
    expect(getRestockShortfallConfirmMessage(summary)).toBe(
      "Kabel Fiber 5 roll tidak dimasukkan dan pengajuan selesai. Lanjutkan?",
    );
    expect(getRestockReceiveSuccessMessage(summary)).toBe(
      "Tersimpan. Barang sudah masuk gudang. Tidak dimasukkan: Kabel Fiber 5 roll.",
    );
  });

  it("pesanan milik satu pengajuan: tanpa konfirmasi bila seluruh sisa pesanan dimasukkan", () => {
    const summary = getRestockReceiveSummary(raisedOrderInput(15));

    expect(summary.notEntered).toEqual([]);
    expect(needsRestockShortfallConfirm(summary)).toBe(false);
  });

  it("pesanan milik satu pengajuan yang diturunkan: patokannya sisa pesanan, bukan jumlah disetujui", () => {
    const summary = getRestockReceiveSummary(
      formInput({
        request: makeRequest({ items: [makeItem({ orderedQuantity: 6 })] }),
        receivedItems: { fiber: 6 },
      }),
    );

    expect(summary.notEntered).toEqual([]);
    expect(needsRestockShortfallConfirm(summary)).toBe(false);
  });

  it("pesanan gabungan: hanya bagian pengajuan ini yang dihitung", () => {
    const complete = getRestockReceiveSummary(mergedOrderInput(5));
    expect(complete.notEntered).toEqual([]);
    expect(needsRestockShortfallConfirm(complete)).toBe(false);

    const short = getRestockReceiveSummary(mergedOrderInput(3));
    expect(short.notEntered).toEqual([
      { barangId: "fiber", nama: "Kabel Fiber", satuan: "roll", quantity: 2 },
    ]);
    expect(getRestockShortfallConfirmMessage(short)).toBe(
      "Kabel Fiber 2 roll tidak dimasukkan dan pengajuan selesai. Lanjutkan?",
    );
  });
});

describe("getRestockReceiveProblems", () => {
  it("meminta jumlah, dan mengarah ke Batalkan, bila belum pernah ada yang masuk", () => {
    expect(
      problemsFor({ receivedItems: { fiber: 0, ont: 0 }, photoCount: 0 }),
    ).toEqual([NOTHING_ENTERED_MESSAGE]);
    expect(NOTHING_ENTERED_MESSAGE).toContain("Batalkan Pengajuan");
  });

  it("tidak menawarkan Selesaikan tanpa barang tambahan pada pengajuan yang belum pernah menerima", () => {
    const summary = getRestockReceiveSummary(
      formInput({ receivedItems: { fiber: 0, ont: 0 } }),
    );

    expect(summary.hasEntry).toBe(false);
    expect(summary.hasEnteredBefore).toBe(false);
    expect(getRestockReceiveSubmitLabel(summary)).toBe("Simpan ke Gudang");
  });

  it("mengizinkan data lama yang sudah pernah menerima diselesaikan tanpa barang tambahan", () => {
    const legacyInput = formInput({
      request: makeRequest({
        items: [makeItem({ receivedQuantity: 4 }), ontItem],
      }),
      receivedItems: { fiber: 0, ont: 0 },
    });

    expect(
      getRestockReceiveProblems({
        ...legacyInput,
        overReceipts: {},
        photoCount: 0,
      }),
    ).toEqual([]);
    expect(
      getRestockReceiveSubmitLabel(getRestockReceiveSummary(legacyInput)),
    ).toBe("Selesaikan tanpa barang tambahan");
  });

  it("meminta foto bila ada barang yang masuk", () => {
    expect(problemsFor({ photoCount: 0 })).toEqual([PHOTO_MISSING_MESSAGE]);
    expect(problemsFor({ photoCount: 1 })).toEqual([]);
  });

  it("meminta alasan untuk barang yang masuk lebih banyak dari sisanya", () => {
    const over = { receivedItems: { fiber: 12, ont: 5 } };

    expect(problemsFor(over)).toEqual([OVER_RECEIPT_REASON_MISSING_MESSAGE]);
    expect(OVER_RECEIPT_REASON_MISSING_MESSAGE).toBe(
      "Tulis alasan barang yang masuk lebih banyak dari sisa pesanan.",
    );
    expect(
      problemsFor({ ...over, overReceipts: { fiber: "Bonus dari toko" } }),
    ).toEqual([]);
  });
});

describe("buildRestockReceivePayload", () => {
  it("mengirim jumlah untuk tepat baris yang masih punya sisa", () => {
    const payload = payloadFor({
      request: makeRequest({
        items: [
          makeItem({ receivedQuantity: 10 }),
          { ...ontItem, statusApproval: "REJECTED" },
          konektorItem,
        ],
      }),
      receivedItems: { fiber: 2, ont: 5, konektor: 0 },
    });

    expect(payload.items).toEqual({ konektor: 0 });
  });

  it("mengirim isian yang lolos skema server, tanpa field alur lama", () => {
    const payload = payloadFor({
      receivedItems: { fiber: 12, ont: 3 },
      substitutions: { ont: "patch-cord" },
      overReceipts: { fiber: " Bonus dari toko " },
    });

    expect(payload).toEqual({
      items: { fiber: 12, ont: 3 },
      substitutions: { ont: "patch-cord" },
      overReceipts: { fiber: "Bonus dari toko" },
      fotoBukti: ["https://cdn.radpro.id/bukti.webp"],
    });
    expect(restockReceiveSchema.safeParse(payload).success).toBe(true);
  });

  it("tidak mengirim barang pengganti untuk barang yang tidak masuk", () => {
    expect(
      payloadFor({
        receivedItems: { fiber: 0, ont: 5 },
        substitutions: { fiber: "patch-cord" },
      }).substitutions,
    ).toEqual({});
  });

  it("tidak mengirim foto saat menyelesaikan tanpa barang tambahan", () => {
    expect(
      payloadFor({
        request: makeRequest({
          items: [makeItem({ receivedQuantity: 4 }), ontItem],
        }),
        receivedItems: { fiber: 0, ont: 0 },
      }),
    ).toEqual({
      items: { fiber: 0, ont: 0 },
      substitutions: {},
      overReceipts: {},
      fotoBukti: [],
    });
  });
});

describe("clampEnteredQuantity", () => {
  const item = makeItem({ receivedQuantity: 4 });

  it("membatasi jumlah pada sisa pesanan tanpa izin mengubah pesanan", () => {
    expect(clampEnteredQuantity(item, 9, false)).toBe(6);
    expect(clampEnteredQuantity(item, 5, false)).toBe(5);
  });

  it("membiarkan kelebihan bagi yang boleh mengubah pesanan", () => {
    expect(clampEnteredQuantity(item, 9, true)).toBe(9);
  });

  it("tidak pernah memberi angka minus", () => {
    expect(clampEnteredQuantity(item, -3, true)).toBe(0);
    expect(clampEnteredQuantity(item, -3, false)).toBe(0);
  });
});

describe("pesan Masukkan Barang", () => {
  it("menyusun toast sukses menurut hasilnya", () => {
    const allEntered = getRestockReceiveSummary(formInput());
    expect(getRestockReceiveSuccessMessage(allEntered)).toBe(
      "Tersimpan. Semua barang sudah masuk gudang.",
    );

    const short = getRestockReceiveSummary(
      formInput({ receivedItems: { fiber: 6, ont: 5 } }),
    );
    expect(getRestockReceiveSuccessMessage(short)).toBe(
      "Tersimpan. Barang sudah masuk gudang. Tidak dimasukkan: Kabel Fiber 4 roll.",
    );

    const nothing = getRestockReceiveSummary(
      formInput({
        request: makeRequest({
          items: [makeItem({ receivedQuantity: 4 }), ontItem],
        }),
        receivedItems: { fiber: 0, ont: 0 },
      }),
    );
    expect(getRestockReceiveSuccessMessage(nothing)).toBe(
      "Tersimpan. Pengajuan selesai tanpa barang tambahan.",
    );
  });

  it("menghitung jenis barang bila lebih dari dua yang tidak dimasukkan", () => {
    const summary = getRestockReceiveSummary(
      formInput({
        request: makeRequest({ items: [makeItem(), ontItem, konektorItem] }),
        receivedItems: { fiber: 1, ont: 1, konektor: 1 },
      }),
    );
    expect(getRestockReceiveSuccessMessage(summary)).toBe(
      "Tersimpan. Barang sudah masuk gudang. 3 jenis barang tidak dimasukkan.",
    );
  });

  it("meminta konfirmasi hanya bila ada barang yang masuk kurang dari sisanya", () => {
    const complete = getRestockReceiveSummary(formInput());
    expect(needsRestockShortfallConfirm(complete)).toBe(false);

    const short = getRestockReceiveSummary(
      formInput({ receivedItems: { fiber: 6, ont: 3 } }),
    );
    expect(needsRestockShortfallConfirm(short)).toBe(true);
    expect(getRestockShortfallConfirmMessage(short)).toBe(
      "Kabel Fiber 4 roll, ONT 2 pcs tidak dimasukkan dan pengajuan selesai. Lanjutkan?",
    );
  });

  it("menulis daftar barang dengan satuannya", () => {
    expect(
      describeRestockReceiveLines([
        { barangId: "fiber", nama: "Kabel Fiber", satuan: "roll", quantity: 4 },
        { barangId: "ont", nama: "ONT", satuan: "pcs", quantity: 2 },
      ]),
    ).toBe("Kabel Fiber 4 roll, ONT 2 pcs");
  });
});
