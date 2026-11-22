import { describe, expect, it, vi } from "vitest";

// Barrel `@/modules/inventory` ikut memuat service, repository, dan Prisma.
// Presenter hanya memakai aturan status murni, yang juga diekspor entrypoint
// klien modul, jadi tes memakai implementasi aslinya tanpa barrel.
vi.mock("@/modules/inventory", () =>
  vi.importActual("@/modules/inventory/client"),
);

import {
  presentRestockRequestForMobile,
  type MobileRestockLineSource,
  type MobileRestockRequest,
  type MobileRestockSource,
} from "@/app/api/mobile/inventory/pengajuan/presentRestockRequest";

/** Nilai `tahap` yang membuat build lama tidak menggambar garis tahap. */
const LEGACY_EMPTY_STAGE: MobileRestockRequest["tahap"] = {
  sekarang: null,
  berhentiDi: null,
  total: 0,
  judul: [],
};
/** Kosakata tahap pembelian dan daftar tahap yang sudah dihapus. */
const RETIRED_WORDING = /beli|belanja|tahap/i;
const AWAITING_APPROVAL_SENTENCE = "Menunggu persetujuan atasan.";
const APPROVED_SENTENCE = "Sudah disetujui. Menunggu barangnya sampai.";

/** Bentuk dari repository: tanggal masih `Date`, belum lewat JSON. */
function makeSource(
  overrides: Partial<MobileRestockSource> = {},
): MobileRestockSource {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "DRAFT",
    tanggal: new Date("2026-11-01T03:00:00.000Z"),
    requester: { name: "Budi" },
    gudang: { nama: "Gudang Site A" },
    purchaseOrderId: null,
    purchaseOrder: null,
    catatanApproval: null,
    cancelReason: null,
    goodsReceipts: [],
    jasaItems: [],
    items: [makeItem()],
    ...overrides,
  };
}

/** Pengajuan yang sudah disetujui; pesanannya dibuat otomatis saat disetujui. */
function makeApprovedSource(
  overrides: Partial<MobileRestockSource> = {},
): MobileRestockSource {
  return makeSource({
    status: "APPROVED",
    purchaseOrderId: "po-1",
    purchaseOrder: { status: "DRAFT" },
    ...overrides,
  });
}

/** Baris barang dari read model; tanpa pesanan, `orderedQuantity` = `jumlah`. */
function makeItem(
  overrides: Partial<MobileRestockLineSource> = {},
): MobileRestockLineSource {
  return {
    id: "item-1",
    barangId: "barang-1",
    jumlah: 10,
    orderedQuantity: 10,
    receivedQuantity: 0,
    cancelledQuantity: 0,
    statusApproval: "PENDING",
    catatanApproval: null,
    barang: { nama: "Kabel Fiber", satuan: "roll" },
    ...overrides,
  };
}

/** Baris yang ditolak atasan: read model tidak memesan apa pun untuknya. */
function makeRejectedItem(
  overrides: Partial<MobileRestockLineSource> = {},
): MobileRestockLineSource {
  return makeItem({
    id: "item-ditolak",
    barangId: "barang-2",
    jumlah: 5,
    orderedQuantity: 0,
    statusApproval: "REJECTED",
    barang: { nama: "Patch Cord", satuan: "pcs" },
    ...overrides,
  });
}

/** Satu pengajuan untuk setiap status tampilan, termasuk data lama, sudah dibentuk. */
function presentEveryStatus(): MobileRestockRequest[] {
  const sources: MobileRestockSource[] = [
    makeSource({ status: "DRAFT" }),
    makeSource({ status: "SUBMITTED" }),
    makeApprovedSource({
      items: [makeItem({ statusApproval: "APPROVED" }), makeRejectedItem()],
    }),
    makeApprovedSource({
      status: "ORDERED",
      purchaseOrder: { status: "ORDERED" },
      items: [makeItem({ receivedQuantity: 4 })],
    }),
    makeApprovedSource({
      status: "RECEIVED",
      purchaseOrder: { status: "RECEIVED" },
      items: [makeItem({ receivedQuantity: 8, cancelledQuantity: 2 })],
    }),
    makeApprovedSource({ status: "CANCELLED", cancelReason: "Salah gudang" }),
    makeSource({
      status: "REJECTED",
      catatanApproval: "Stok masih ada",
      items: [makeItem({ statusApproval: "REJECTED" })],
    }),
    makeSource({ items: [], jasaItems: [{ statusKonfirmasi: "PENDING" }] }),
    makeApprovedSource({
      items: [],
      jasaItems: [{ statusKonfirmasi: "PENDING" }],
    }),
  ];
  return sources.map((source) => presentRestockRequestForMobile(source));
}

describe("presentRestockRequestForMobile", () => {
  it.each(["DRAFT", "SUBMITTED"])(
    "pengajuan %s menunggu persetujuan atasan: Sudah Diajukan, belum ada jumlah disetujui",
    (status) => {
      const presented = presentRestockRequestForMobile(makeSource({ status }));

      expect(presented).toMatchObject({
        id: "pr-1",
        nomor: "PR-001",
        tanggal: "2026-11-01T03:00:00.000Z",
        gudang: "Gudang Site A",
        pemohon: "Budi",
        status: {
          kode: "AWAITING_APPROVAL",
          label: "Sudah Diajukan",
          kalimat: AWAITING_APPROVAL_SENTENCE,
        },
        tahap: LEGACY_EMPTY_STAGE,
        jumlahJasa: 0,
      });
      expect(presented.barang).toEqual([
        {
          id: "item-1",
          nama: "Kabel Fiber",
          satuan: "roll",
          diminta: 10,
          satuanDiminta: "roll",
          disetujui: null,
          dimasukkan: null,
          isDitolak: false,
          catatanAtasan: null,
          dibeli: 0,
          datang: 0,
          tidakDatang: 0,
        },
      ]);
    },
  );

  it.each([
    ["APPROVED", "DRAFT"],
    ["ORDERED", "ORDERED"],
  ])(
    "pengajuan %s (pesanan %s) sudah disetujui: label sama, kalimat menunggu barang dimasukkan",
    (status, orderStatus) => {
      const presented = presentRestockRequestForMobile(
        makeApprovedSource({
          status,
          purchaseOrder: { status: orderStatus },
          items: [
            makeRejectedItem({ catatanApproval: "Stok masih ada" }),
            makeItem({
              jumlah: 8,
              jumlahDiminta: 10,
              orderedQuantity: 8,
              statusApproval: "APPROVED",
              catatanApproval: "Stok gudang masih 2 roll",
            }),
          ],
        }),
      );

      expect(presented.status).toEqual({
        kode: "APPROVED",
        label: "Sudah Diajukan",
        kalimat: APPROVED_SENTENCE,
      });
      expect(presented.barang.map((line) => line.nama)).toEqual([
        "Kabel Fiber",
        "Patch Cord",
      ]);
      expect(presented.barang[0]).toMatchObject({
        diminta: 10,
        disetujui: 8,
        dimasukkan: null,
        isDitolak: false,
        catatanAtasan: "Stok gudang masih 2 roll",
        dibeli: 0,
        datang: 0,
        tidakDatang: 0,
      });
      expect(presented.barang[1]).toMatchObject({
        diminta: 5,
        satuanDiminta: "pcs",
        disetujui: null,
        dimasukkan: null,
        isDitolak: true,
        catatanAtasan: "Stok masih ada",
        dibeli: 0,
        datang: 0,
        tidakDatang: 0,
      });
    },
  );

  it("data lama yang sudah menerima sebagian tetap menunggu barang dimasukkan", () => {
    const presented = presentRestockRequestForMobile(
      makeApprovedSource({
        status: "ORDERED",
        purchaseOrder: { status: "ORDERED" },
        goodsReceipts: [{ id: "grn-lama" }],
        items: [makeItem({ receivedQuantity: 4 })],
      }),
    );

    expect(presented.status.kode).toBe("APPROVED");
    expect(presented.barang[0]).toMatchObject({
      disetujui: 10,
      dimasukkan: 4,
      dibeli: 4,
      datang: 4,
      tidakDatang: 0,
    });
  });

  it("tidak membocorkan nomor pesanan maupun catatan belanja lama", () => {
    const legacyPurchasedItem = {
      ...makeItem(),
      purchasedQuantity: 6,
      purchaseOrderItemId: "poi-1",
    };
    const source = {
      ...makeApprovedSource({
        status: "ORDERED",
        items: [legacyPurchasedItem],
      }),
      purchaseOrder: { id: "po-1", poNumber: "PO-RAHASIA", status: "ORDERED" },
      purchaseRecords: [{ id: "catatan-belanja-1", purchasedQuantity: 6 }],
    };

    const presented = presentRestockRequestForMobile(source);

    expect(presented.status.kode).toBe("APPROVED");
    expect(presented.barang[0]).toMatchObject({
      dimasukkan: null,
      dibeli: 0,
      datang: 0,
    });
    const json = JSON.stringify(presented);
    expect(json).not.toContain("PO-RAHASIA");
    expect(json).not.toContain("catatan-belanja-1");
  });

  it("Sudah Sampai: angka per barang, termasuk 0 untuk yang tidak masuk", () => {
    const presented = presentRestockRequestForMobile(
      makeApprovedSource({
        status: "RECEIVED",
        purchaseOrder: { status: "RECEIVED" },
        goodsReceipts: [{ id: "grn-1" }],
        items: [
          makeItem({ receivedQuantity: 8, cancelledQuantity: 2 }),
          makeItem({
            id: "item-2",
            barangId: "barang-2",
            jumlah: 5,
            orderedQuantity: 5,
            cancelledQuantity: 5,
            barang: { nama: "Patch Cord", satuan: "pcs" },
          }),
        ],
      }),
    );

    expect(presented.status).toEqual({
      kode: "RECEIVED",
      label: "Sudah Sampai",
      kalimat: "Barangnya sudah sampai.",
    });
    expect(presented.barang[0]).toMatchObject({
      disetujui: 10,
      dimasukkan: 8,
      dibeli: 8,
      datang: 8,
      tidakDatang: 2,
    });
    expect(presented.barang[1]).toMatchObject({
      disetujui: 5,
      dimasukkan: 0,
      dibeli: 0,
      datang: 0,
      tidakDatang: 5,
    });
  });

  it("data lama yang semua barangnya sudah masuk atau dicoret dianggap Sudah Sampai", () => {
    const presented = presentRestockRequestForMobile(
      makeApprovedSource({
        status: "ORDERED",
        purchaseOrder: { status: "ORDERED" },
        items: [makeItem({ receivedQuantity: 6, cancelledQuantity: 4 })],
      }),
    );

    expect(presented.status.kode).toBe("RECEIVED");
    expect(presented.barang[0]).toMatchObject({
      disetujui: 10,
      dimasukkan: 6,
      tidakDatang: 4,
    });
  });

  it.each([
    ["RECEIVED", "Sudah Sampai"],
    ["CANCELLED", "Dibatalkan"],
  ])(
    "pengajuan APPROVED mengikuti status pesanannya (%s)",
    (orderStatus, label) => {
      const presented = presentRestockRequestForMobile(
        makeApprovedSource({ purchaseOrder: { status: orderStatus } }),
      );

      expect(presented.status).toMatchObject({ kode: orderStatus, label });
    },
  );

  it("Dibatalkan: alasan admin ikut di kalimat; belum ada yang dimasukkan", () => {
    const presented = presentRestockRequestForMobile(
      makeApprovedSource({
        status: "CANCELLED",
        purchaseOrder: { status: "CANCELLED" },
        cancelReason: "Barang sudah ada di gudang lain",
      }),
    );

    expect(presented.status).toEqual({
      kode: "CANCELLED",
      label: "Dibatalkan",
      kalimat:
        "Pengajuan ini dibatalkan admin. Alasan: Barang sudah ada di gudang lain",
    });
    expect(presented.barang[0]).toMatchObject({
      disetujui: 10,
      dimasukkan: null,
      dibeli: 0,
      datang: 0,
      tidakDatang: 10,
    });
  });

  it("Dibatalkan dengan alasan kosong setelah sebagian barang masuk (data lama)", () => {
    const presented = presentRestockRequestForMobile(
      makeApprovedSource({
        status: "CANCELLED",
        cancelReason: "   ",
        items: [makeItem({ receivedQuantity: 4, cancelledQuantity: 6 })],
      }),
    );

    expect(presented.status.kalimat).toBe("Pengajuan ini dibatalkan admin.");
    expect(presented.barang[0]).toMatchObject({
      dimasukkan: 4,
      datang: 4,
      tidakDatang: 6,
    });
  });

  it("Ditolak atasan: semua barang ditandai ditolak dan alasannya ikut", () => {
    const presented = presentRestockRequestForMobile(
      makeSource({
        status: "REJECTED",
        catatanApproval: "Stok gudang masih cukup",
        items: [makeItem({ statusApproval: "PENDING" })],
        jasaItems: [{ statusKonfirmasi: "PENDING", statusApproval: "PENDING" }],
      }),
    );

    expect(presented.status).toEqual({
      kode: "REJECTED",
      label: "Ditolak",
      kalimat: "Pengajuan ini tidak disetujui. Alasan: Stok gudang masih cukup",
    });
    expect(presented.barang[0]).toMatchObject({
      isDitolak: true,
      disetujui: null,
      dimasukkan: null,
      tidakDatang: 0,
    });
    expect(presented.jumlahJasa).toBe(0);
  });

  it("barang diganti atasan: nama asal ikut, jumlah dan satuan yang diajukan dari barang asal", () => {
    const presented = presentRestockRequestForMobile(
      makeApprovedSource({
        items: [
          makeItem({
            barangId: "barang-pengganti",
            barangIdDiminta: "barang-asal",
            jumlah: 300,
            orderedQuantity: 300,
            jumlahDiminta: 1,
            statusApproval: "APPROVED",
            catatanApproval: "Pakai kabel meteran",
            barang: { nama: "Kabel Drop", satuan: "meter" },
            barangDiminta: { nama: "Kabel Drop 1 Roll", satuan: "roll" },
          }),
        ],
      }),
    );

    expect(presented.barang[0]).toMatchObject({
      nama: "Kabel Drop (pengganti Kabel Drop 1 Roll)",
      satuan: "meter",
      diminta: 1,
      satuanDiminta: "roll",
      disetujui: 300,
      catatanAtasan: "Pakai kabel meteran",
    });
  });

  it.each([
    [
      "AWAITING_APPROVAL",
      AWAITING_APPROVAL_SENTENCE,
      makeSource({ items: [], jasaItems: [{ statusKonfirmasi: "PENDING" }] }),
    ],
    [
      "APPROVED",
      "Sudah disetujui. Menunggu admin mengonfirmasi jasanya.",
      makeApprovedSource({
        items: [makeRejectedItem()],
        jasaItems: [{ statusKonfirmasi: "PENDING" }],
      }),
    ],
    [
      "RECEIVED",
      "Jasanya sudah dikonfirmasi admin.",
      makeApprovedSource({
        status: "RECEIVED",
        items: [],
        jasaItems: [{ statusKonfirmasi: "SELESAI" }],
      }),
    ],
  ])(
    "pengajuan jasa saja (%s) memakai kalimat jasa",
    (kode, kalimat, source) => {
      const presented = presentRestockRequestForMobile(source);

      expect(presented.status).toMatchObject({ kode, kalimat });
      expect(presented.jumlahJasa).toBe(1);
    },
  );

  it("jasa yang ditolak atasan tidak dihitung; pengajuan barang tetap memakai kalimat barang", () => {
    const presented = presentRestockRequestForMobile(
      makeApprovedSource({
        jasaItems: [
          { statusKonfirmasi: "PENDING" },
          { statusKonfirmasi: "PENDING", statusApproval: "REJECTED" },
        ],
      }),
    );

    expect(presented.jumlahJasa).toBe(1);
    expect(presented.status.kalimat).toBe(APPROVED_SENTENCE);
  });

  it("tanggal yang sudah berupa teks ISO dan data kosong tetap terbaca", () => {
    const presented = presentRestockRequestForMobile(
      makeSource({
        tanggal: "2026-11-02T04:00:00.000Z",
        gudang: null,
        requester: null,
        items: [makeItem({ barang: null })],
      }),
    );

    expect(presented).toMatchObject({
      tanggal: "2026-11-02T04:00:00.000Z",
      gudang: "-",
      pemohon: null,
    });
    expect(presented.barang[0]).toMatchObject({
      nama: "Barang",
      satuan: "",
      satuanDiminta: "",
    });
  });

  describe("kontrak untuk build aplikasi lama", () => {
    it("garis tahap selalu kosong supaya tidak tergambar", () => {
      for (const presented of presentEveryStatus()) {
        expect(presented.tahap).toEqual(LEGACY_EMPTY_STAGE);
      }
    });

    it("field baris lama selalu berupa angka", () => {
      const lines = presentEveryStatus().flatMap(
        (presented) => presented.barang,
      );

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(typeof line.dibeli).toBe("number");
        expect(typeof line.datang).toBe("number");
        expect(typeof line.tidakDatang).toBe("number");
        expect(
          line.disetujui === null || typeof line.disetujui === "number",
        ).toBe(true);
      }
    });

    it("label dan kalimat tidak menyebut pembelian, belanja, atau tahap", () => {
      const presentedForEveryStatus = presentEveryStatus();
      const wording = presentedForEveryStatus.flatMap((presented) => [
        presented.status.label,
        presented.status.kalimat,
      ]);

      expect(
        new Set(
          presentedForEveryStatus.map((presented) => presented.status.kode),
        ),
      ).toEqual(
        new Set([
          "AWAITING_APPROVAL",
          "APPROVED",
          "RECEIVED",
          "REJECTED",
          "CANCELLED",
        ]),
      );
      for (const text of wording) {
        expect(text).not.toMatch(RETIRED_WORDING);
      }
    });
  });
});
