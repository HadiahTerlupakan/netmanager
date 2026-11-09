import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PurchaseRequest } from "@/app/admin/inventory/restock/types";

const mockResponsiveTable = vi.fn((_props?: unknown) => null);
const mockGeneratePurchaseRequestPdf = vi.fn();

vi.mock("@/components/ui/ResponsiveTable", () => ({
  ResponsiveTable: (props: unknown): null => {
    mockResponsiveTable(props);
    return null;
  },
}));

vi.mock("@/app/admin/inventory/restock/pdf", () => ({
  generatePurchaseRequestPdf: (request: PurchaseRequest) =>
    mockGeneratePurchaseRequestPdf(request),
}));

vi.mock("@/app/admin/inventory/restock/RestockStatusBadge", () => ({
  RestockStatusBadge: ({ request }: { request: PurchaseRequest }) => (
    <span>{request.status}</span>
  ),
  RestockProgressStatus: ({ request }: { request: PurchaseRequest }) => (
    <span>status {request.status}</span>
  ),
}));

import { RestockTable } from "@/app/admin/inventory/restock/RestockTable";

type ResponsiveTableProps = {
  data: PurchaseRequest[];
  page?: number;
  totalPages?: number;
  itemsPerPage?: number | "all";
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (value: number | "all") => void;
  emptyMessage?: React.ReactNode;
  renderMobileCard?: (
    request: PurchaseRequest,
    columns: ResponsiveTableProps["columns"],
  ) => React.ReactNode;
  columns: Array<{
    key: string;
    render: (request: PurchaseRequest) => React.ReactElement;
    align?: "left" | "center" | "right";
    className?: string;
    minWidth?: string;
  }>;
};

const baseRequest: PurchaseRequest = {
  id: "pr-1",
  nomorRequest: "PR-001",
  status: "DRAFT",
  createdAt: "2026-04-19T00:00:00.000Z",
  requester: { name: "Rohadim" },
  gudangId: "gudang-a",
  gudang: { id: "gudang-a", nama: "Gudang A" },
  keterangan: "Restock untuk instalasi pelanggan cluster Depok",
  items: [],
};

function renderTable(
  props?: Partial<React.ComponentProps<typeof RestockTable>>,
) {
  renderToStaticMarkup(
    <RestockTable
      requests={props?.requests ?? [baseRequest]}
      loading={false}
      search={props?.search ?? ""}
      onSearchChange={props?.onSearchChange ?? vi.fn()}
      statusFilter={props?.statusFilter ?? "all"}
      onStatusFilterChange={props?.onStatusFilterChange ?? vi.fn()}
      statusOptions={
        props?.statusOptions ?? [{ value: "all", label: "Semua Status" }]
      }
      gudangFilter={props?.gudangFilter ?? "all"}
      onGudangFilterChange={props?.onGudangFilterChange ?? vi.fn()}
      gudangOptions={
        props?.gudangOptions ?? [{ value: "all", label: "Semua Gudang" }]
      }
      currentPage={props?.currentPage ?? 1}
      totalPages={props?.totalPages ?? 1}
      itemsPerPage={props?.itemsPerPage ?? 10}
      onPageChange={props?.onPageChange ?? vi.fn()}
      onItemsPerPageChange={props?.onItemsPerPageChange ?? vi.fn()}
      canApprove={props?.canApprove ?? true}
      canUpdate={props?.canUpdate ?? true}
      canVerify={props?.canVerify ?? true}
      canDelete={props?.canDelete ?? true}
      onOpenCreate={vi.fn()}
      onOpenEdit={vi.fn()}
      onOpenDetail={vi.fn()}
      onOpenApproval={props?.onOpenApproval ?? vi.fn()}
      onOpenReceive={props?.onOpenReceive ?? vi.fn()}
      onOpenPurchaseLink={props?.onOpenPurchaseLink ?? vi.fn()}
      onOpenCloseUnpurchased={props?.onOpenCloseUnpurchased ?? vi.fn()}
      onOpenConfirmJasa={props?.onOpenConfirmJasa ?? vi.fn()}
      onDelete={vi.fn()}
    />,
  );

  const lastCall = mockResponsiveTable.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error("ResponsiveTable harus dipanggil");
  }

  return lastCall[0] as ResponsiveTableProps;
}

type ActionElementProps = {
  label?: string;
  onClick?: () => void;
  children?: React.ReactNode;
};

/** Cari tombol aksi menurut aria-label di pohon elemen tanpa merender DOM. */
function findActionByLabel(
  node: React.ReactNode,
  label: string,
): ActionElementProps | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findActionByLabel(child, label);
      if (found) return found;
    }
    return null;
  }
  if (!React.isValidElement<ActionElementProps>(node)) return null;
  if (node.props.label === label) return node.props;
  return findActionByLabel(node.props.children, label);
}

function renderActions(
  request: PurchaseRequest,
  permissions?: Partial<{
    canApprove: boolean;
    canUpdate: boolean;
    canVerify: boolean;
    canDelete: boolean;
  }>,
) {
  const props = renderTable({
    requests: [request],
    canApprove: permissions?.canApprove,
    canUpdate: permissions?.canUpdate,
    canVerify: permissions?.canVerify,
    canDelete: permissions?.canDelete,
  });
  const actionColumn = props.columns.find((column) => column.key === "actions");

  if (!actionColumn) {
    throw new Error("Kolom actions harus tersedia");
  }

  return renderToStaticMarkup(actionColumn.render(request));
}

describe("RestockTable action visibility", () => {
  beforeEach(() => {
    mockResponsiveTable.mockClear();
    mockGeneratePurchaseRequestPdf.mockClear();
  });

  it("shows edit approve and delete actions for draft requests with full permissions", () => {
    const markup = renderActions(baseRequest);

    expect(markup).toContain('title="Edit"');
    expect(markup).toContain("Tinjau &amp; Putuskan");
    expect(markup).toContain('title="Hapus"');
    expect(markup).not.toContain("Verifikasi Sampai");
  });

  it("hides draft management actions when related permissions are missing", () => {
    const markup = renderActions(baseRequest, {
      canApprove: false,
      canUpdate: false,
      canDelete: false,
    });

    expect(markup).not.toContain('title="Edit"');
    expect(markup).not.toContain("Tinjau &amp; Putuskan");
    expect(markup).not.toContain('title="Hapus"');
  });

  const verifyOnly = { canApprove: false, canUpdate: false, canVerify: true };
  const orderedRequest = (
    poStatus: string,
    items: PurchaseRequest["items"] = [],
  ): PurchaseRequest => ({
    ...baseRequest,
    status: "ORDERED",
    purchaseOrder: { id: "po-1", poNumber: "PO-1", status: poStatus },
    items,
  });
  const fiberLine = (receivedQuantity: number, purchasedQuantity = 0) => ({
    id: "item-1",
    barangId: "barang-1",
    jumlah: 10,
    receivedQuantity,
    purchaseOrderItemId: "poi-1",
    purchasedQuantity,
    barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
  });

  it("offers only the shopping link while nothing was reported bought", () => {
    const markup = renderActions(
      orderedRequest("DRAFT", [fiberLine(0)]),
      verifyOnly,
    );

    expect(markup).toContain("Kirim Link Belanja");
    expect(markup).toContain(
      'aria-label="Kirim Link Belanja, pengajuan PR-001"',
    );
    expect(markup).not.toContain("Catat Belanja");
    // Tahap pembelian belum dilaporkan: barang belum bisa dicatat datang.
    expect(markup).not.toContain("Catat Barang Datang");
    expect(markup).toContain('title="Hapus"');
  });

  it("keeps offering the shopping link while only part was bought", () => {
    const markup = renderActions(
      orderedRequest("ORDERED", [fiberLine(0, 4)]),
      verifyOnly,
    );

    expect(markup).toContain("Kirim Link Belanja");
    expect(markup).toContain("Catat Barang Datang");
    // Link tetap tombol utama selama tahap pembelian belum selesai.
    expect(markup.indexOf("Kirim Link Belanja")).toBeLessThan(
      markup.indexOf("Catat Barang Datang"),
    );
  });

  it("offers nothing to record once everything bought has arrived", () => {
    const markup = renderActions(
      orderedRequest("PARTIAL", [fiberLine(4, 4)]),
      verifyOnly,
    );

    expect(markup).toContain("Kirim Link Belanja");
    expect(markup).not.toContain("Catat");
  });

  it("merged orders get no shopping link; recording goods stays primary", () => {
    const merged: PurchaseRequest = {
      ...orderedRequest("DRAFT", [fiberLine(0)]),
      purchaseOrder: {
        id: "po-1",
        poNumber: "PO-1",
        status: "DRAFT",
        _count: { purchaseRequests: 2 },
      },
    };
    const markup = renderActions(merged, verifyOnly);

    expect(markup).not.toContain("Kirim Link Belanja");
    expect(markup).toContain("Catat Barang Datang");
    expect(markup).toContain("bg-indigo-700");
  });

  it("offers recording goods once bought and the next delivery once partial", () => {
    const bought = renderActions(
      orderedRequest("ORDERED", [fiberLine(0, 10)]),
      verifyOnly,
    );
    const partial = renderActions(
      orderedRequest("PARTIAL", [fiberLine(6, 10)]),
      verifyOnly,
    );

    expect(bought).toContain("Catat Barang Datang");
    expect(bought).toContain('aria-label="Catat Barang Datang untuk PR-001"');
    expect(bought).not.toContain("Kirim Link Belanja");
    expect(partial).toContain("Catat Kiriman Berikutnya");
    expect(partial).toContain(
      'aria-label="Catat Kiriman Berikutnya untuk PR-001"',
    );
  });

  it("hides receive actions when finished or without verify permission", () => {
    const finished = renderActions(
      { ...orderedRequest("RECEIVED", [fiberLine(10)]), status: "RECEIVED" },
      verifyOnly,
    );
    const noPermission = renderActions(
      orderedRequest("ORDERED", [fiberLine(0)]),
      {
        ...verifyOnly,
        canVerify: false,
      },
    );

    expect(finished).not.toContain("Catat");
    expect(noPermission).not.toContain("Catat");
    expect(noPermission).not.toContain("Kirim Link Belanja");
  });

  it("hides delete once the goods were bought or anything arrived", () => {
    expect(
      renderActions(orderedRequest("ORDERED", [fiberLine(0)])),
    ).not.toContain('title="Hapus"');
    expect(
      renderActions(orderedRequest("DRAFT", [fiberLine(2)])),
    ).not.toContain('title="Hapus"');
  });

  it("opens the shopping-link panel with the whole request", () => {
    const onOpenPurchaseLink = vi.fn();
    const request = orderedRequest("DRAFT", [fiberLine(0)]);
    const props = renderTable({ requests: [request], onOpenPurchaseLink });
    const actionColumn = props.columns.find(
      (column) => column.key === "actions",
    );

    findActionByLabel(
      actionColumn?.render(request),
      "Kirim Link Belanja, pengajuan PR-001",
    )?.onClick?.();

    expect(onOpenPurchaseLink).toHaveBeenCalledWith(request);
  });

  it("offers closing a request stuck without a shopping list", () => {
    const onOpenCloseUnpurchased = vi.fn();
    const request: PurchaseRequest = {
      ...baseRequest,
      status: "APPROVED",
      purchaseOrder: null,
      items: [
        {
          id: "item-1",
          barangId: "barang-1",
          jumlah: 5,
          receivedQuantity: 0,
          barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
        },
      ],
    };
    const props = renderTable({ requests: [request], onOpenCloseUnpurchased });
    const actionColumn = props.columns.find(
      (column) => column.key === "actions",
    );
    const label = "Tutup sisa yang tidak jadi dibeli untuk PR-001";

    findActionByLabel(actionColumn?.render(request), label)?.onClick?.();

    expect(onOpenCloseUnpurchased).toHaveBeenCalledWith(request);
    expect(renderActions(request, { canVerify: false })).not.toContain(
      "Tutup sisa",
    );
  });

  it("uses tighter column sizing and right-aligned action layout for denser table rhythm", () => {
    const props = renderTable();
    const nomorColumn = props.columns.find((column) => column.key === "nomor");
    const gudangColumn = props.columns.find(
      (column) => column.key === "gudang",
    );
    const keteranganColumn = props.columns.find(
      (column) => column.key === "keterangan",
    );
    const statusColumn = props.columns.find(
      (column) => column.key === "status",
    );
    const actionColumn = props.columns.find(
      (column) => column.key === "actions",
    );

    expect(nomorColumn?.minWidth).toBe("10rem");
    expect(gudangColumn?.minWidth).toBe("7.5rem");
    expect(keteranganColumn?.minWidth).toBe("7rem");
    expect(statusColumn?.align).toBe("left");
    // Lebar status & aksi harus minWidth (dipatuhi tabel), bukan kelas w-[..]
    // yang hanya saran: dulu kolom status terjepit sampai satu kata per baris.
    expect(statusColumn?.minWidth).toBe("14rem");
    expect(actionColumn?.align).toBe("right");
    expect(actionColumn?.minWidth).toBe("14rem");
    expect(
      props.columns.some((column) => column.key === "tanggalPengajuan"),
    ).toBe(false);
  });

  it("renders compact action cluster and balanced filter toolbar controls", () => {
    const actionMarkup = renderActions(baseRequest);
    const pageMarkup = renderToStaticMarkup(
      <RestockTable
        requests={[baseRequest]}
        loading={false}
        search=""
        onSearchChange={vi.fn()}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        statusOptions={[{ value: "all", label: "Semua Status" }]}
        gudangFilter="all"
        onGudangFilterChange={vi.fn()}
        gudangOptions={[{ value: "all", label: "Semua Gudang" }]}
        currentPage={1}
        totalPages={1}
        itemsPerPage={10}
        onPageChange={vi.fn()}
        onItemsPerPageChange={vi.fn()}
        canApprove={true}
        canUpdate={true}
        canVerify={true}
        canDelete={true}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onOpenDetail={vi.fn()}
        onOpenApproval={vi.fn()}
        onOpenReceive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(actionMarkup).toContain("justify-end");
    expect(actionMarkup).toContain("min-w-[2.25rem]");
    expect(actionMarkup).toContain("rounded-xl");
    expect(actionMarkup).toContain("min-w-[6.75rem]");
    expect(pageMarkup).toContain(
      "lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(11rem,0.5fr))]",
    );
    expect(pageMarkup).toContain("rounded-[1.5rem]");
    expect(pageMarkup).toContain("tracking-[0.1em]");
    expect(pageMarkup).toContain("text-[10px]");
  });

  it("passes pagination props and filtered data to ResponsiveTable", () => {
    const onPageChange = vi.fn();
    const onItemsPerPageChange = vi.fn();
    const props = renderTable({
      requests: [baseRequest],
      currentPage: 2,
      totalPages: 4,
      itemsPerPage: 25,
      onPageChange,
      onItemsPerPageChange,
    });

    expect(props.page).toBe(2);
    expect(props.totalPages).toBe(4);
    expect(props.itemsPerPage).toBe(25);
    expect(props.data).toEqual([baseRequest]);
    expect(props.onPageChange).toBe(onPageChange);
    expect(props.onItemsPerPageChange).toBe(onItemsPerPageChange);
  });

  it("renders status and gudang filter controls in the header", () => {
    const markup = renderToStaticMarkup(
      <RestockTable
        requests={[baseRequest]}
        loading={false}
        search=""
        onSearchChange={vi.fn()}
        statusFilter="DRAFT"
        onStatusFilterChange={vi.fn()}
        statusOptions={[
          { value: "all", label: "Semua Status" },
          { value: "DRAFT", label: "Draft" },
        ]}
        gudangFilter="gudang-a"
        onGudangFilterChange={vi.fn()}
        gudangOptions={[
          { value: "all", label: "Semua Gudang" },
          { value: "gudang-a", label: "Depok" },
        ]}
        currentPage={1}
        totalPages={1}
        itemsPerPage={10}
        onPageChange={vi.fn()}
        onItemsPerPageChange={vi.fn()}
        canApprove={true}
        canUpdate={true}
        canVerify={true}
        canDelete={true}
        onOpenCreate={vi.fn()}
        onOpenEdit={vi.fn()}
        onOpenDetail={vi.fn()}
        onOpenApproval={vi.fn()}
        onOpenReceive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(markup).toContain("Filter status");
    expect(markup).toContain("Filter gudang");
    expect(markup).toContain("Semua Status");
    expect(markup).toContain("Semua Gudang");
  });

  it("passes filtered empty copy to distinguish no results from no data", () => {
    const props = renderTable({
      requests: [],
      search: "PR-404",
      statusFilter: "APPROVED",
      gudangFilter: "gudang-a",
    });

    expect(renderToStaticMarkup(<>{props.emptyMessage}</>)).toContain(
      "Tidak ada pengajuan yang cocok dengan filter aktif",
    );
  });

  it("adds accessible labels to icon-only row actions", () => {
    const markup = renderActions(baseRequest);

    expect(markup).toContain('aria-label="Lihat detail PR-001"');
    expect(markup).toContain('aria-label="Unduh PDF pengajuan PR-001"');
    expect(markup).toContain('aria-label="Edit PR-001"');
    expect(markup).toContain('aria-label="Hapus PR-001"');
  });

  it("provides a custom mobile card renderer for restock rows", () => {
    const props = renderTable();

    expect(typeof props.renderMobileCard).toBe("function");

    const markup = renderToStaticMarkup(
      <>{props.renderMobileCard?.(baseRequest, props.columns)}</>,
    );

    expect(markup).toContain("PR-001");
    expect(markup).toContain("Gudang A");
    expect(markup).toContain("Tinjau &amp; Putuskan");
  });

  it("renders the keterangan column value in desktop table rows", () => {
    const props = renderTable();
    const keteranganColumn = props.columns.find(
      (column) => column.key === "keterangan",
    );

    if (!keteranganColumn) {
      throw new Error("Kolom keterangan harus tersedia");
    }

    const markup = renderToStaticMarkup(keteranganColumn.render(baseRequest));

    expect(markup).toContain("Restock untuk instalasi pelanggan cluster Depok");
  });

  it("shows a placeholder dash when keterangan is empty", () => {
    const props = renderTable();
    const keteranganColumn = props.columns.find(
      (column) => column.key === "keterangan",
    );

    if (!keteranganColumn) {
      throw new Error("Kolom keterangan harus tersedia");
    }

    const markup = renderToStaticMarkup(
      keteranganColumn.render({ ...baseRequest, keterangan: null }),
    );

    expect(markup).toContain("italic");
    expect(markup).toContain("—");
  });

  it("renders the keterangan line in the mobile card", () => {
    const props = renderTable();
    const markup = renderToStaticMarkup(
      <>{props.renderMobileCard?.(baseRequest, props.columns)}</>,
    );

    expect(markup).toContain("Catatan:");
    expect(markup).toContain("Restock untuk instalasi pelanggan cluster Depok");
  });

  it("opens the decision modal with the whole request from the approval button", () => {
    const onOpenApproval = vi.fn();
    const props = renderTable({ onOpenApproval });
    const actionColumn = props.columns.find(
      (column) => column.key === "actions",
    );
    const button = findActionByLabel(
      actionColumn?.render(baseRequest),
      "Tinjau dan putuskan PR-001",
    );

    button?.onClick?.();

    expect(onOpenApproval).toHaveBeenCalledWith(baseRequest);
  });

  it("renders the Konfirmasi Jasa action for approved requests with pending services", () => {
    const withPendingJasa: PurchaseRequest = {
      ...baseRequest,
      status: "APPROVED",
      jasaItems: [
        {
          id: "jasa-item-1",
          jasaId: "jasa-1",
          jumlah: 1,
          hargaPerUnit: 100,
          totalHarga: 100,
          statusKonfirmasi: "PENDING",
          jasa: { id: "jasa-1", kode: "JS-1", nama: "Splicing", satuan: "job" },
        },
      ],
    };

    expect(renderActions(withPendingJasa)).toContain("Konfirmasi Jasa");
  });

  it("hides Konfirmasi Jasa when the only pending service was rejected", () => {
    const withRejectedJasa: PurchaseRequest = {
      ...baseRequest,
      status: "APPROVED",
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
      ],
    };

    expect(renderActions(withRejectedJasa)).not.toContain("Konfirmasi Jasa");
  });
});
