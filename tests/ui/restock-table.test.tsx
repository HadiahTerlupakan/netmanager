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
      onOpenCancel={props?.onOpenCancel ?? vi.fn()}
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
): string {
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
    expect(markup).not.toContain("Masukkan Barang");
    expect(markup).not.toContain("Batalkan Pengajuan");
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

  it("keeps editing open for a submitted request but not the approval button", () => {
    const markup = renderActions({ ...baseRequest, status: "SUBMITTED" });

    expect(markup).toContain('title="Edit"');
    expect(markup).not.toContain("Tinjau &amp; Putuskan");
  });

  const verifyOnly = { canApprove: false, canUpdate: false, canVerify: true };
  const fiberLine = (
    receivedQuantity: number,
  ): PurchaseRequest["items"][number] => ({
    id: "item-1",
    barangId: "barang-1",
    jumlah: 10,
    receivedQuantity,
    barang: { nama: "Kabel Fiber", kode: "BRG-1", satuan: "roll" },
  });
  const approvedRequest = (
    poStatus: string | null,
    items: PurchaseRequest["items"] = [fiberLine(0)],
  ): PurchaseRequest => ({
    ...baseRequest,
    status: poStatus ? "ORDERED" : "APPROVED",
    purchaseOrder: poStatus
      ? { id: "po-1", poNumber: "PO-1", status: poStatus }
      : null,
    items,
  });

  it("offers Masukkan Barang as the main action and Batalkan for an approved request", () => {
    const markup = renderActions(approvedRequest("DRAFT"), verifyOnly);

    expect(markup).toContain("Masukkan Barang");
    expect(markup).toContain('aria-label="Masukkan Barang untuk PR-001"');
    expect(markup).toContain("bg-indigo-700");
    expect(markup).toContain('title="Batalkan Pengajuan"');
    expect(markup).toContain('aria-label="Batalkan Pengajuan PR-001"');
    expect(markup).not.toContain("Tinjau &amp; Putuskan");
    expect(markup).not.toContain('title="Edit"');
    expect(markup).not.toContain("Link Belanja");
  });

  it("orders the actions: detail, PDF, Masukkan Barang, Batalkan, Hapus", () => {
    const markup = renderActions(approvedRequest("DRAFT"));
    const positions = [
      'aria-label="Lihat detail PR-001"',
      'aria-label="Unduh PDF pengajuan PR-001"',
      'aria-label="Masukkan Barang untuk PR-001"',
      'aria-label="Batalkan Pengajuan PR-001"',
      'aria-label="Hapus PR-001"',
    ].map((label) => markup.indexOf(label));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("offers both actions when the order could not be created at approval", () => {
    const markup = renderActions(approvedRequest(null), verifyOnly);

    expect(markup).toContain("Masukkan Barang");
    expect(markup).toContain('title="Batalkan Pengajuan"');
  });

  it("keeps Masukkan Barang but not Batalkan once a legacy request received goods", () => {
    const markup = renderActions(approvedRequest("PARTIAL", [fiberLine(4)]));

    expect(markup).toContain("Masukkan Barang");
    expect(markup).not.toContain('title="Batalkan Pengajuan"');
    expect(markup).not.toContain('title="Hapus"');
  });

  it("still offers Batalkan on a merged order after another request entered goods", () => {
    const withReceipt = (linkedRequestCount: number): PurchaseRequest => ({
      ...approvedRequest("PARTIAL"),
      purchaseOrder: {
        id: "po-1",
        poNumber: "PO-1",
        status: "PARTIAL",
        linkedRequestCount,
      },
      goodsReceipts: [{ id: "grn-1", grnNumber: "GRN-1", fotoBukti: [] }],
    });

    expect(renderActions(withReceipt(2), verifyOnly)).toContain(
      'title="Batalkan Pengajuan"',
    );
    expect(renderActions(withReceipt(1), verifyOnly)).not.toContain(
      'title="Batalkan Pengajuan"',
    );
  });

  it("marks the detail and cancel buttons so focus can find them after a reload", () => {
    const markup = renderActions(approvedRequest("DRAFT"), verifyOnly);

    expect(markup).toContain('data-restock-focus="detail:pr-1"');
    expect(markup).toContain('data-restock-focus="cancel:pr-1"');
    expect(markup.match(/data-restock-focus=/g)).toHaveLength(2);
  });

  it("hides Masukkan Barang and Batalkan when closed or without verify permission", () => {
    const received = renderActions(
      { ...approvedRequest("RECEIVED", [fiberLine(10)]), status: "RECEIVED" },
      verifyOnly,
    );
    const rejected = renderActions({ ...baseRequest, status: "REJECTED" });
    const cancelled = renderActions({
      ...approvedRequest("CANCELLED"),
      status: "CANCELLED",
    });
    const noPermission = renderActions(approvedRequest("DRAFT"), {
      ...verifyOnly,
      canVerify: false,
    });

    for (const markup of [received, rejected, cancelled, noPermission]) {
      expect(markup).not.toContain("Masukkan Barang");
      expect(markup).not.toContain("Batalkan Pengajuan");
    }
  });

  it("offers Batalkan but not Masukkan Barang on an approved request with services only", () => {
    const markup = renderActions({
      ...approvedRequest("DRAFT", []),
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
    });

    expect(markup).not.toContain("Masukkan Barang");
    expect(markup).toContain('title="Batalkan Pengajuan"');
    expect(markup).toContain("Konfirmasi Jasa");
  });

  it("hides delete once the order is processed or anything arrived", () => {
    expect(renderActions(approvedRequest("DRAFT"))).toContain('title="Hapus"');
    expect(renderActions(approvedRequest("ORDERED"))).not.toContain(
      'title="Hapus"',
    );
    expect(
      renderActions(approvedRequest("DRAFT", [fiberLine(2)])),
    ).not.toContain('title="Hapus"');
  });

  it("opens Masukkan Barang and Batalkan with the whole request", () => {
    const onOpenReceive = vi.fn();
    const onOpenCancel = vi.fn();
    const request = approvedRequest("DRAFT");
    const props = renderTable({
      requests: [request],
      onOpenReceive,
      onOpenCancel,
    });
    const actionColumn = props.columns.find(
      (column) => column.key === "actions",
    );
    const actions = actionColumn?.render(request);

    findActionByLabel(actions, "Masukkan Barang untuk PR-001")?.onClick?.();
    findActionByLabel(actions, "Batalkan Pengajuan PR-001")?.onClick?.();

    expect(onOpenReceive).toHaveBeenCalledWith(request);
    expect(onOpenCancel).toHaveBeenCalledWith(request);
  });

  it("downloads the PDF right away", () => {
    const props = renderTable();
    const actionColumn = props.columns.find(
      (column) => column.key === "actions",
    );

    findActionByLabel(
      actionColumn?.render(baseRequest),
      "Unduh PDF pengajuan PR-001",
    )?.onClick?.();

    expect(mockGeneratePurchaseRequestPdf).toHaveBeenCalledWith(baseRequest);
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
        onOpenCancel={vi.fn()}
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
        statusFilter="AWAITING_APPROVAL"
        onStatusFilterChange={vi.fn()}
        statusOptions={[
          { value: "all", label: "Semua Status" },
          { value: "AWAITING_APPROVAL", label: "Menunggu Persetujuan" },
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
        onOpenCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(markup).toContain("Filter status");
    expect(markup).toContain("Filter gudang");
    expect(markup).toContain("Semua Status");
    expect(markup).toContain("Menunggu Persetujuan");
    expect(markup).toContain("Semua Gudang");
    expect(markup).toContain(
      "Ajukan barang dan jasa. Setelah disetujui, admin memasukkan barangnya",
    );
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
