import { describe, expect, it } from "vitest";

import {
  buildInitialReceivedItems,
  getPendingJasaItems,
  getRestockEnterableItems,
  buildOverReceiptPayload,
  getRestockEntryBasis,
  getRestockItemRemaining,
  hasMissingOverReceiptReason,
  canApprovePurchaseRequest,
  canRemoveRestockFormItem,
  getFilteredBarangs,
  getPaginatedRestockRequests,
  getRestockFormProblems,
  getVisibleRestockRequests,
  isVeryLowStock,
  PHOTO_UPLOAD_NOT_READY_MESSAGE,
  RESTOCK_STATUS_FILTER_OPTIONS,
  uploadProofPhotos,
} from "@/app/admin/inventory/restock/utils";
import type { PhotoUploadRef } from "@/components/inventory/PhotoUpload";
import type {
  Barang,
  PurchaseRequest,
  RestockFormItem,
  RestockSetting,
} from "@/app/admin/inventory/restock/types";

describe("restock utils", () => {
  const validFormItems: RestockFormItem[] = [
    { tipe: "BARANG", barangId: "barang-1", quantity: 1 },
  ];

  const allBarangs: Barang[] = [
    {
      id: "barang-1",
      kode: "BRG-001",
      nama: "Kabel Fiber",
      satuan: "roll",
      minStokDefault: 10,
      stockPerGudang: [
        {
          id: "stock-1",
          barangId: "barang-1",
          gudangId: "gudang-a",
          stok: 8,
          stokBaru: 8,
          stokBekas: 0,
          stokRusak: 0,
        },
      ],
    },
    {
      id: "barang-2",
      kode: "BRG-002",
      nama: "Konektor",
      satuan: "pcs",
      minStokDefault: 5,
      stockPerGudang: [
        {
          id: "stock-2",
          barangId: "barang-2",
          gudangId: "gudang-a",
          stok: 12,
          stokBaru: 12,
          stokBekas: 0,
          stokRusak: 0,
        },
      ],
    },
  ];

  const settings: RestockSetting[] = [
    {
      id: "setting-1",
      barangId: "barang-1",
      gudangId: "gudang-a",
      minStok: 9,
      maxStok: 20,
    },
    {
      id: "setting-2",
      barangId: "barang-2",
      gudangId: "gudang-a",
      minStok: 6,
      maxStok: 20,
    },
  ];

  const requestList: PurchaseRequest[] = [
    {
      id: "pr-1",
      nomorRequest: "PR-001",
      status: "DRAFT",
      createdAt: "2026-04-19T00:00:00.000Z",
      requester: { name: "Rohadim" },
      gudangId: "gudang-a",
      gudang: { id: "gudang-a", nama: "Depok" },
      items: [],
    },
    {
      id: "pr-2",
      nomorRequest: "PR-002",
      status: "APPROVED",
      createdAt: "2026-04-18T00:00:00.000Z",
      requester: { name: "Rohadim" },
      gudangId: "gudang-b",
      gudang: { id: "gudang-b", nama: "Pemalang" },
      items: [],
    },
    {
      id: "pr-3",
      nomorRequest: "ABC-003",
      status: "ORDERED",
      createdAt: "2026-04-17T00:00:00.000Z",
      requester: { name: "Rohadim" },
      gudangId: "gudang-a",
      gudang: { id: "gudang-a", nama: "Depok" },
      items: [],
    },
  ];

  it("returns only low-stock items for the selected gudang", () => {
    const result = getFilteredBarangs({
      allBarangs,
      allSettings: settings,
      formGudang: "gudang-a",
      showAllItems: false,
    });

    expect(result.map((item) => item.id)).toEqual(["barang-1"]);
  });

  it("returns all items when showAllItems is enabled", () => {
    const result = getFilteredBarangs({
      allBarangs,
      allSettings: settings,
      formGudang: "gudang-a",
      showAllItems: true,
    });

    expect(result.map((item) => item.id)).toEqual(["barang-1", "barang-2"]);
  });

  it("returns no items when gudang has not been selected in filtered mode", () => {
    const result = getFilteredBarangs({
      allBarangs,
      allSettings: settings,
      formGudang: "",
      showAllItems: false,
    });

    expect(result).toEqual([]);
  });

  it("builds initial received items from remaining quantities per barang", () => {
    const request: PurchaseRequest = {
      id: "pr-1",
      nomorRequest: "PR-001",
      status: "ORDERED",
      createdAt: "2026-04-19T00:00:00.000Z",
      requester: { name: "Rohadim" },
      gudangId: "gudang-a",
      gudang: { id: "gudang-a", nama: "Gudang A" },
      purchaseOrder: { id: "po-1", status: "ORDERED" },
      items: [
        {
          id: "item-1",
          barangId: "barang-1",
          jumlah: 10,
          receivedQuantity: 4,
          barang: { nama: "Kabel Fiber", kode: "BRG-001", satuan: "roll" },
        },
        {
          id: "item-2",
          barangId: "barang-1",
          jumlah: 3,
          receivedQuantity: 1,
          barang: { nama: "Kabel Fiber", kode: "BRG-001", satuan: "roll" },
        },
      ],
    };

    expect(buildInitialReceivedItems(request)).toEqual({
      "barang-1": 8,
    });
  });

  describe("getRestockEntryBasis", () => {
    const line: PurchaseRequest["items"][number] = {
      id: "item-1",
      barangId: "barang-1",
      jumlah: 10,
      orderedQuantity: 25,
      receivedQuantity: 5,
      barang: { nama: "Kabel Fiber", kode: "BRG-001", satuan: "roll" },
    };
    const orderedRequest = (linkedRequestCount?: number): PurchaseRequest => ({
      id: "pr-1",
      nomorRequest: "PR-001",
      status: "ORDERED",
      createdAt: "2026-04-19T00:00:00.000Z",
      requester: { name: "Rohadim" },
      gudangId: "gudang-a",
      gudang: { id: "gudang-a", nama: "Gudang A" },
      purchaseOrder: { id: "po-1", status: "ORDERED", linkedRequestCount },
      items: [line],
    });

    it("uses the whole order remainder for an order owned by one request", () => {
      expect(getRestockItemRemaining(line)).toBe(20);
      expect(getRestockEntryBasis(line, orderedRequest(1))).toBe(20);
      expect(getRestockEntryBasis(line, orderedRequest())).toBe(20);
      expect(buildInitialReceivedItems(orderedRequest(1))).toEqual({
        "barang-1": 20,
      });
    });

    it("caps a merged order at the quantity approved for this request", () => {
      expect(getRestockEntryBasis(line, orderedRequest(2))).toBe(10);
      expect(buildInitialReceivedItems(orderedRequest(2))).toEqual({
        "barang-1": 10,
      });
    });

    it("follows a merged order remainder that is already below the approved quantity", () => {
      const nearlyDone = { ...line, receivedQuantity: 22 };

      expect(
        getRestockEntryBasis(nearlyDone, {
          purchaseOrder: { linkedRequestCount: 2 },
        }),
      ).toBe(3);
    });

    it("treats a request without an order as owning its order", () => {
      expect(
        getRestockEntryBasis(
          { ...line, orderedQuantity: undefined, receivedQuantity: 0 },
          { purchaseOrder: null },
        ),
      ).toBe(10);
    });
  });

  it("excludes cancelled quantities from the initial received items", () => {
    const request: PurchaseRequest = {
      id: "pr-1",
      nomorRequest: "PR-001",
      status: "ORDERED",
      createdAt: "2026-04-19T00:00:00.000Z",
      requester: { name: "Rohadim" },
      gudangId: "gudang-a",
      gudang: { id: "gudang-a", nama: "Gudang A" },
      purchaseOrder: { id: "po-1", status: "ORDERED" },
      items: [
        {
          id: "item-1",
          barangId: "barang-1",
          jumlah: 10,
          receivedQuantity: 4,
          cancelledQuantity: 2,
          barang: { nama: "Kabel Fiber", kode: "BRG-001", satuan: "roll" },
        },
        {
          id: "item-2",
          barangId: "barang-2",
          jumlah: 5,
          receivedQuantity: 3,
          cancelledQuantity: 2,
          barang: { nama: "Pigtail", kode: "BRG-002", satuan: "pcs" },
        },
      ],
    };

    // Baris tanpa sisa tidak diisi lagi; server meminta tepat baris yang
    // masih punya sisa.
    expect(buildInitialReceivedItems(request)).toEqual({ "barang-1": 4 });
    expect(
      getRestockEnterableItems(request).map((item) => item.barangId),
    ).toEqual(["barang-1"]);
  });

  it("only allows approval for draft requests with approval permission", () => {
    expect(canApprovePurchaseRequest("DRAFT", true)).toBe(true);
    expect(canApprovePurchaseRequest("SUBMITTED", true)).toBe(false);
    expect(canApprovePurchaseRequest("DRAFT", false)).toBe(false);
  });

  it("isVeryLowStock returns false when minStok is 0 (no setting)", () => {
    expect(isVeryLowStock(0, 0)).toBe(false);
    expect(isVeryLowStock(5, 0)).toBe(false);
  });

  it("isVeryLowStock returns true when stock is at or below half of minStok", () => {
    expect(isVeryLowStock(4, 10)).toBe(true);
    expect(isVeryLowStock(5, 10)).toBe(true);
    expect(isVeryLowStock(6, 10)).toBe(false);
  });

  const formProblems = (
    formItems: RestockFormItem[],
    formNotes = "Restock untuk instalasi pelanggan",
  ): string[] =>
    getRestockFormProblems({ formGudang: "gudang-a", formNotes, formItems });

  it("asks for at least one item", () => {
    expect(formProblems([])).toEqual([
      "Belum ada barang atau jasa. Tekan Tambah Barang atau Tambah Jasa.",
    ]);
  });

  it("asks for the note when it is empty or only spaces", () => {
    const missingNote =
      "Catatan belum diisi. Tulis untuk apa barang ini dibeli.";
    expect(formProblems(validFormItems, "")).toEqual([missingNote]);
    expect(formProblems(validFormItems, "   ")).toEqual([missingNote]);
  });

  it("names the row with an unselected item or an invalid quantity", () => {
    expect(
      formProblems([{ tipe: "BARANG", barangId: "", quantity: 1 }]),
    ).toEqual(["Baris ke-1: barangnya belum dipilih."]);
    expect(
      formProblems([{ tipe: "BARANG", barangId: "barang-1", quantity: 0 }]),
    ).toEqual(["Baris ke-1: jumlahnya harus 1 atau lebih."]);
  });

  it("has no problem once the gudang, note, and every item are filled", () => {
    expect(formProblems(validFormItems)).toEqual([]);
    expect(
      formProblems([{ tipe: "JASA", jasaId: "jasa-1", quantity: 1 }]),
    ).toEqual([]);
  });

  it("rejects the same barang twice but allows the same jasa twice", () => {
    expect(
      formProblems([
        { tipe: "BARANG", barangId: "barang-1", quantity: 1 },
        { tipe: "BARANG", barangId: "barang-1", quantity: 2 },
      ]),
    ).toEqual([
      "Barang yang sama dipilih lebih dari sekali (baris 1, 2). Hapus salah satu barisnya, lalu jumlahkan di satu baris saja.",
    ]);
    expect(
      formProblems([
        { tipe: "JASA", jasaId: "jasa-1", quantity: 1 },
        { tipe: "JASA", jasaId: "jasa-1", quantity: 2 },
      ]),
    ).toEqual([]);
  });

  it("only allows removing form items when more than one item exists", () => {
    expect(canRemoveRestockFormItem(validFormItems.length)).toBe(false);
    expect(canRemoveRestockFormItem(2)).toBe(true);
  });

  it("filters restock requests by search status and gudang together", () => {
    const visibleRequests = getVisibleRestockRequests({
      requests: requestList,
      search: "PR",
      statusFilter: "APPROVED",
      gudangFilter: "gudang-b",
    });

    expect(visibleRequests.map((request) => request.id)).toEqual(["pr-2"]);
  });

  it("filters by the status shown on the badge, not the database status", () => {
    const filterBy = (statusFilter: "AWAITING_APPROVAL" | "APPROVED") =>
      getVisibleRestockRequests({
        requests: requestList,
        search: "",
        statusFilter,
        gudangFilter: "all",
      }).map((request) => request.id);

    expect(filterBy("AWAITING_APPROVAL")).toEqual(["pr-1"]);
    expect(filterBy("APPROVED")).toEqual(["pr-2", "pr-3"]);
  });

  it("lists every status in the filter, in the order a request moves", () => {
    expect(RESTOCK_STATUS_FILTER_OPTIONS).toEqual([
      { value: "all", label: "Semua Status" },
      { value: "AWAITING_APPROVAL", label: "Menunggu Persetujuan" },
      { value: "APPROVED", label: "Disetujui" },
      { value: "RECEIVED", label: "Sudah Dimasukkan" },
      { value: "REJECTED", label: "Ditolak" },
      { value: "CANCELLED", label: "Dibatalkan" },
    ]);
  });

  it("paginates restock requests based on page and items per page", () => {
    const paginated = getPaginatedRestockRequests({
      requests: requestList,
      page: 2,
      itemsPerPage: 1,
    });

    expect(paginated.data.map((request) => request.id)).toEqual(["pr-2"]);
    expect(paginated.totalPages).toBe(3);
    expect(paginated.page).toBe(2);
  });

  it("returns all restock requests when items per page is all", () => {
    const paginated = getPaginatedRestockRequests({
      requests: requestList,
      page: 3,
      itemsPerPage: "all",
    });

    expect(paginated.data.map((request) => request.id)).toEqual([
      "pr-1",
      "pr-2",
      "pr-3",
    ]);
    expect(paginated.totalPages).toBe(1);
    expect(paginated.page).toBe(1);
  });

  describe("uploadProofPhotos", () => {
    it("mengembalikan URL dari PhotoUpload yang terpasang", async () => {
      const photoUpload: PhotoUploadRef = {
        uploadPhotos: async () => ["https://cdn.radpro.id/bukti.webp"],
        getPhotos: () => [],
        resetPhotos: () => {},
      };

      await expect(
        uploadProofPhotos({ current: photoUpload }),
      ).resolves.toEqual(["https://cdn.radpro.id/bukti.webp"]);
    });

    // Regresi: ref kosong dulu dilewati diam-diam sehingga foto tidak pernah
    // diunggah dan server membalas "foto wajib diunggah" meski foto sudah dipilih.
    it("gagal jelas bila komponen unggah foto tidak terpasang", async () => {
      await expect(uploadProofPhotos({ current: null })).rejects.toThrow(
        PHOTO_UPLOAD_NOT_READY_MESSAGE,
      );
      await expect(uploadProofPhotos(undefined)).rejects.toThrow(
        PHOTO_UPLOAD_NOT_READY_MESSAGE,
      );
    });
  });

  describe("over-delivery reasons", () => {
    const items = [
      {
        id: "item-1",
        barangId: "barang-1",
        jumlah: 10,
        receivedQuantity: 0,
        barang: { nama: "Pigtail", kode: "P", satuan: "pcs" },
      },
      {
        id: "item-2",
        barangId: "barang-2",
        jumlah: 5,
        receivedQuantity: 0,
        barang: { nama: "ONT", kode: "O", satuan: "unit" },
      },
    ] as PurchaseRequest["items"];

    it("requires a reason only for the item that exceeds what is outstanding", () => {
      const received = { "barang-1": 20, "barang-2": 5 };

      expect(hasMissingOverReceiptReason(items, received, {})).toBe(true);
      expect(
        hasMissingOverReceiptReason(items, received, { "barang-1": "Bonus" }),
      ).toBe(false);
    });

    it("measures what is outstanding from the PO quantity when the PO merges requests", () => {
      expect(
        getRestockItemRemaining({
          ...items[0],
          jumlah: 10,
          orderedQuantity: 25,
          receivedQuantity: 5,
        }),
      ).toBe(20);
    });

    it("drops reasons left behind once the quantity is lowered again", () => {
      expect(
        buildOverReceiptPayload(
          items,
          { "barang-1": 10, "barang-2": 6 },
          { "barang-1": "Bonus", "barang-2": "  Salah hitung supplier " },
        ),
      ).toEqual({ "barang-2": "Salah hitung supplier" });
    });
  });

  describe("rejected lines", () => {
    const decidedRequest: PurchaseRequest = {
      id: "pr-1",
      nomorRequest: "PR-001",
      status: "ORDERED",
      createdAt: "2026-11-01T00:00:00.000Z",
      requester: { name: "Rohadim" },
      gudangId: "gudang-a",
      gudang: { id: "gudang-a", nama: "Gudang A" },
      purchaseOrder: { id: "po-1", status: "ORDERED" },
      items: [
        {
          id: "item-1",
          barangId: "barang-1",
          jumlah: 10,
          receivedQuantity: 0,
          statusApproval: "APPROVED",
          barang: { nama: "Kabel Fiber", kode: "BRG-001", satuan: "roll" },
        },
        {
          id: "item-2",
          barangId: "barang-2",
          jumlah: 5,
          receivedQuantity: 0,
          statusApproval: "REJECTED",
          barang: { nama: "Konektor", kode: "BRG-002", satuan: "pcs" },
        },
        {
          id: "item-3",
          barangId: "barang-3",
          jumlah: 3,
          receivedQuantity: 0,
          statusApproval: "PENDING",
          barang: { nama: "Patch Cord", kode: "BRG-003", satuan: "pcs" },
        },
      ],
      jasaItems: [
        {
          id: "jasa-item-1",
          jasaId: "jasa-1",
          jumlah: 1,
          hargaPerUnit: 100,
          totalHarga: 100,
          statusKonfirmasi: "PENDING",
          statusApproval: "REJECTED",
          jasa: { id: "jasa-1", kode: "JS-1", nama: "Splicing", satuan: "job" },
        },
        {
          id: "jasa-item-2",
          jasaId: "jasa-2",
          jumlah: 1,
          hargaPerUnit: 100,
          totalHarga: 100,
          statusKonfirmasi: "PENDING",
          jasa: {
            id: "jasa-2",
            kode: "JS-2",
            nama: "Tarik Kabel",
            satuan: "job",
          },
        },
      ],
    };

    it("leaves rejected barang out of receiving but keeps pending legacy lines", () => {
      expect(
        getRestockEnterableItems(decidedRequest).map((item) => item.id),
      ).toEqual(["item-1", "item-3"]);
      expect(buildInitialReceivedItems(decidedRequest)).toEqual({
        "barang-1": 10,
        "barang-3": 3,
      });
    });

    it("does not ask to confirm rejected jasa", () => {
      expect(
        getPendingJasaItems(decidedRequest).map((item) => item.id),
      ).toEqual(["jasa-item-2"]);
    });
  });
});
