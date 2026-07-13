import { describe, expect, it } from "vitest";

import {
  buildInitialReceivedItems,
  canApprovePurchaseRequest,
  canDeletePurchaseRequest,
  canEditPurchaseRequest,
  canReceivePurchaseRequest,
  canRemoveRestockFormItem,
  canSubmitRestockForm,
  getFilteredBarangs,
  getPaginatedRestockRequests,
  getRestockFilterOptions,
  getVisibleRestockRequests,
  isVeryLowStock,
} from "@/app/admin/inventory/restock/utils";
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

  it("only allows deletion for draft requests", () => {
    expect(canDeletePurchaseRequest("DRAFT", true)).toBe(true);
    expect(canDeletePurchaseRequest("APPROVED", true)).toBe(false);
    expect(canDeletePurchaseRequest("DRAFT", false)).toBe(false);
  });

  it("only allows editing for draft requests", () => {
    expect(canEditPurchaseRequest("DRAFT", true)).toBe(true);
    expect(canEditPurchaseRequest("ORDERED", true)).toBe(false);
    expect(canEditPurchaseRequest("DRAFT", false)).toBe(false);
  });

  it("only allows approval for draft requests with approval permission", () => {
    expect(canApprovePurchaseRequest("DRAFT", true)).toBe(true);
    expect(canApprovePurchaseRequest("SUBMITTED", true)).toBe(false);
    expect(canApprovePurchaseRequest("DRAFT", false)).toBe(false);
  });

  it("only allows receive action for approved or ordered requests with verify permission", () => {
    expect(canReceivePurchaseRequest("APPROVED", true)).toBe(true);
    expect(canReceivePurchaseRequest("ORDERED", true)).toBe(true);
    expect(canReceivePurchaseRequest("RECEIVED", true)).toBe(false);
    expect(canReceivePurchaseRequest("ORDERED", false)).toBe(false);
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

  it("prevents submit when restock form has no items", () => {
    expect(
      canSubmitRestockForm({
        formGudang: "gudang-a",
        formNotes: "Restock untuk instalasi pelanggan",
        formItems: [],
        isSubmitting: false,
      }),
    ).toBe(false);
  });

  it("prevents submit when catatan / keterangan is empty or whitespace", () => {
    expect(
      canSubmitRestockForm({
        formGudang: "gudang-a",
        formNotes: "",
        formItems: validFormItems,
        isSubmitting: false,
      }),
    ).toBe(false);

    expect(
      canSubmitRestockForm({
        formGudang: "gudang-a",
        formNotes: "   ",
        formItems: validFormItems,
        isSubmitting: false,
      }),
    ).toBe(false);
  });

  it("prevents submit when an item is incomplete or quantity is invalid", () => {
    expect(
      canSubmitRestockForm({
        formGudang: "gudang-a",
        formNotes: "Restock untuk instalasi pelanggan",
        formItems: [{ tipe: "BARANG", barangId: "", quantity: 1 }],
        isSubmitting: false,
      }),
    ).toBe(false);

    expect(
      canSubmitRestockForm({
        formGudang: "gudang-a",
        formNotes: "Restock untuk instalasi pelanggan",
        formItems: [{ tipe: "BARANG", barangId: "barang-1", quantity: 0 }],
        isSubmitting: false,
      }),
    ).toBe(false);
  });

  it("allows submit only when gudang and all items are valid", () => {
    expect(
      canSubmitRestockForm({
        formGudang: "gudang-a",
        formNotes: "Restock untuk instalasi pelanggan",
        formItems: validFormItems,
        isSubmitting: false,
      }),
    ).toBe(true);
  });

  it("prevents submit when the same barang is selected more than once", () => {
    expect(
      canSubmitRestockForm({
        formGudang: "gudang-a",
        formNotes: "Restock untuk instalasi pelanggan",
        formItems: [
          { tipe: "BARANG", barangId: "barang-1", quantity: 1 },
          { tipe: "BARANG", barangId: "barang-1", quantity: 2 },
        ],
        isSubmitting: false,
      }),
    ).toBe(false);
  });

  it("allows submit for jasa items with valid jasaId and quantity", () => {
    expect(
      canSubmitRestockForm({
        formGudang: "gudang-a",
        formNotes: "Restock jasa instalasi",
        formItems: [{ tipe: "JASA", jasaId: "jasa-1", quantity: 1 }],
        isSubmitting: false,
      }),
    ).toBe(true);
  });

  it("allows submit when the same jasa is selected more than once", () => {
    expect(
      canSubmitRestockForm({
        formGudang: "gudang-a",
        formNotes: "Restock jasa ganda",
        formItems: [
          { tipe: "JASA", jasaId: "jasa-1", quantity: 1 },
          { tipe: "JASA", jasaId: "jasa-1", quantity: 2 },
        ],
        isSubmitting: false,
      }),
    ).toBe(true);
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

  it("returns all valid restock status options even when current data is sparse", () => {
    expect(getRestockFilterOptions(requestList)).toEqual([
      { value: "all", label: "Semua Status" },
      { value: "DRAFT", label: "Draft" },
      { value: "SUBMITTED", label: "Diajukan" },
      { value: "APPROVED", label: "Disetujui" },
      { value: "REJECTED", label: "Ditolak" },
      { value: "ORDERED", label: "Dalam Pengiriman" },
      { value: "RECEIVED", label: "Selesai" },
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
});
