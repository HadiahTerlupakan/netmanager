import type {
  Barang,
  BarangGudang,
  PurchaseRequest,
  PurchaseRequestItem,
  RestockFormItem,
  RestockSetting,
  RestockSubstitutionMap,
} from "./types";

interface VisibleRestockRequestsInput {
  requests: PurchaseRequest[];
  search: string;
  statusFilter: PurchaseRequest["status"] | "all";
  gudangFilter: string;
}

interface PaginatedRestockRequestsInput {
  requests: PurchaseRequest[];
  page: number;
  itemsPerPage: number | "all";
}

interface GetFilteredBarangsInput {
  allBarangs: Barang[];
  allSettings: RestockSetting[];
  formGudang: string;
  showAllItems: boolean;
}

interface CanSubmitRestockFormInput {
  formGudang: string;
  formNotes: string;
  formItems: RestockFormItem[];
  isSubmitting: boolean;
}

function getBarangStocks(barang: Barang): BarangGudang[] {
  return barang.stockPerGudang || barang.barangGudang || [];
}

function getStockInfo(
  barang: Barang,
  gudangId: string,
): BarangGudang | undefined {
  return getBarangStocks(barang).find(
    (stock) => (stock.gudangId || stock.gudang?.id) === gudangId,
  );
}

export function getMinStockForBarang(
  barang: Barang,
  allSettings: RestockSetting[],
  gudangId: string,
): number {
  const setting = allSettings.find(
    (item) => item.barangId === barang.id && item.gudangId === gudangId,
  );
  return (setting?.minStok ?? barang.minStokDefault) || 0;
}

export function getFilteredBarangs({
  allBarangs,
  allSettings,
  formGudang,
  showAllItems,
}: GetFilteredBarangsInput): Barang[] {
  if (showAllItems) {
    return allBarangs;
  }

  if (!formGudang) {
    return [];
  }

  return allBarangs.filter((barang) => {
    const currentStockBaru = getStockInfo(barang, formGudang)?.stokBaru || 0;
    const minStock = getMinStockForBarang(barang, allSettings, formGudang);
    return currentStockBaru <= minStock;
  });
}

export function buildInitialReceivedItems(
  request: PurchaseRequest,
): Record<string, number> {
  return request.items.reduce<Record<string, number>>((acc, item) => {
    const remainingQuantity = item.jumlah - item.receivedQuantity;
    acc[item.barangId] = (acc[item.barangId] || 0) + remainingQuantity;
    return acc;
  }, {});
}

/** Item yang sudah pernah diterima sebagian tidak boleh diganti barangnya. */
export function canSubstituteRestockItem(item: PurchaseRequestItem): boolean {
  return item.receivedQuantity <= 0;
}

/**
 * Buang substitusi yang tidak berdampak (kosong / sama dengan barang asli)
 * supaya payload penerimaan tetap bersih.
 */
export function buildSubstitutionPayload(
  substitutions: RestockSubstitutionMap,
): RestockSubstitutionMap {
  return Object.entries(substitutions).reduce<RestockSubstitutionMap>(
    (acc, [originalBarangId, replacementBarangId]) => {
      if (replacementBarangId && replacementBarangId !== originalBarangId) {
        acc[originalBarangId] = replacementBarangId;
      }
      return acc;
    },
    {},
  );
}

export function canDeletePurchaseRequest(
  status: PurchaseRequest["status"],
  canDelete: boolean,
): boolean {
  return canDelete && status !== "RECEIVED";
}

export function canEditPurchaseRequest(
  status: PurchaseRequest["status"],
  canUpdate: boolean,
): boolean {
  return canUpdate && status === "DRAFT";
}

export function canApprovePurchaseRequest(
  status: PurchaseRequest["status"],
  canApprove: boolean,
): boolean {
  return canApprove && status === "DRAFT";
}

export function canReceivePurchaseRequest(
  status: PurchaseRequest["status"],
  canVerify: boolean,
): boolean {
  return canVerify && (status === "APPROVED" || status === "ORDERED");
}

export function canSubmitRestockForm({
  formGudang,
  formNotes,
  formItems,
  isSubmitting,
}: CanSubmitRestockFormInput): boolean {
  if (
    isSubmitting ||
    !formGudang ||
    !formNotes.trim() ||
    formItems.length === 0
  ) {
    return false;
  }

  const allItemsValid = formItems.every((item) => {
    if (item.tipe === "JASA") {
      return !!item.jasaId && item.quantity > 0;
    }
    return !!item.barangId && item.quantity > 0;
  });
  if (!allItemsValid) return false;

  const barangIds = formItems
    .filter((item) => item.tipe === "BARANG")
    .map((item) => item.barangId)
    .filter(Boolean);
  const hasDuplicateBarang = new Set(barangIds).size !== barangIds.length;

  return !hasDuplicateBarang;
}

export function canRemoveRestockFormItem(totalItems: number): boolean {
  return totalItems > 1;
}

export function getRestockToggleLabel(showAllItems: boolean): string {
  return showAllItems ? "Lihat Semua Barang" : "Filter Stok Minim";
}

export function getRestockToggleHint(showAllItems: boolean): string {
  return showAllItems
    ? "Menampilkan semua barang untuk restock manual"
    : "Menampilkan hanya barang dengan stok minim";
}

export function isVeryLowStock(
  currentStockBaru: number,
  minStock: number,
): boolean {
  return minStock > 0 && currentStockBaru * 2 <= minStock;
}

export function getStockSnapshot(
  barang: Barang | undefined,
  allSettings: RestockSetting[],
  gudangId: string,
) {
  if (!barang || !gudangId) {
    return {
      stokBaru: 0,
      stokBekas: 0,
      stokRusak: 0,
      minStock: 0,
    };
  }

  const stockInfo = getStockInfo(barang, gudangId);
  return {
    stokBaru: stockInfo?.stokBaru || 0,
    stokBekas: stockInfo?.stokBekas || 0,
    stokRusak: stockInfo?.stokRusak || 0,
    minStock: getMinStockForBarang(barang, allSettings, gudangId),
  };
}

export function formatStatusLabel(status: PurchaseRequest["status"]): {
  label: string;
  className: string;
} {
  const configs: Record<
    PurchaseRequest["status"],
    { label: string; className: string }
  > = {
    DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-800" },
    SUBMITTED: {
      label: "Diajukan",
      className: "bg-yellow-100 text-yellow-800",
    },
    APPROVED: { label: "Disetujui", className: "bg-green-100 text-green-800" },
    REJECTED: { label: "Ditolak", className: "bg-red-100 text-red-800" },
    ORDERED: {
      label: "Dalam Pengiriman",
      className: "bg-blue-100 text-blue-800",
    },
    RECEIVED: { label: "Selesai", className: "bg-indigo-100 text-indigo-800" },
    CANCELLED: { label: "Dibatalkan", className: "bg-red-100 text-red-800" },
  };

  return configs[status];
}

function wordStartMatch(text: string, term: string): boolean {
  if (text.includes(term)) return true;
  const words = text.split(/[\s\-_/,.]+/);
  return words.some((word) => word.startsWith(term));
}

function matchesSearchTerms(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.every((term) => wordStartMatch(lower, term));
}

function requestMatchesSearch(
  request: PurchaseRequest,
  terms: string[],
): boolean {
  if (terms.length === 0) return true;

  const searchableTexts = [
    request.nomorRequest,
    request.gudang?.nama || "",
    request.keterangan || "",
    ...(request.items?.flatMap((item) => [
      item.barang?.nama || "",
      item.barang?.kode || "",
    ]) || []),
    ...(request.jasaItems?.flatMap((item) => [
      item.jasa?.nama || "",
      item.jasa?.kode || "",
    ]) || []),
  ];

  return searchableTexts.some((text) => matchesSearchTerms(text, terms));
}

export function getVisibleRestockRequests({
  requests,
  search,
  statusFilter,
  gudangFilter,
}: VisibleRestockRequestsInput): PurchaseRequest[] {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return requests.filter((request) => {
    const matchesSearch = requestMatchesSearch(request, terms);
    const matchesStatus =
      statusFilter === "all" || request.status === statusFilter;
    const matchesGudang =
      gudangFilter === "all" || request.gudangId === gudangFilter;
    return matchesSearch && matchesStatus && matchesGudang;
  });
}

const RESTOCK_STATUS_OPTIONS: PurchaseRequest["status"][] = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "ORDERED",
  "RECEIVED",
  "CANCELLED",
];

export function getRestockFilterOptions(_requests: PurchaseRequest[]) {
  return [
    { value: "all", label: "Semua Status" },
    ...RESTOCK_STATUS_OPTIONS.map((status) => ({
      value: status,
      label: formatStatusLabel(status).label,
    })),
  ];
}

export function getPaginatedRestockRequests({
  requests,
  page,
  itemsPerPage,
}: PaginatedRestockRequestsInput) {
  if (itemsPerPage === "all") {
    return {
      data: requests,
      page: 1,
      totalPages: 1,
    };
  }

  const totalPages = Math.max(1, Math.ceil(requests.length / itemsPerPage));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (normalizedPage - 1) * itemsPerPage;

  return {
    data: requests.slice(startIndex, startIndex + itemsPerPage),
    page: normalizedPage,
    totalPages,
  };
}
