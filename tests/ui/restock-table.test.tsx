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
  RestockStatusBadge: ({ status }: { status: PurchaseRequest["status"] }) => (
    <span>{status}</span>
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
      onApprove={vi.fn()}
      onOpenReceive={vi.fn()}
      onDelete={vi.fn()}
    />,
  );

  const lastCall = mockResponsiveTable.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error("ResponsiveTable harus dipanggil");
  }

  return lastCall[0] as ResponsiveTableProps;
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
    expect(markup).toContain("Approve");
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
    expect(markup).not.toContain("Approve");
    expect(markup).not.toContain('title="Hapus"');
  });

  it("shows receive action only for ordered or approved requests with verify permission", () => {
    const orderedMarkup = renderActions(
      { ...baseRequest, status: "ORDERED" },
      { canApprove: false, canUpdate: false, canVerify: true },
    );
    const approvedMarkup = renderActions(
      { ...baseRequest, status: "APPROVED" },
      { canApprove: false, canUpdate: false, canVerify: true },
    );
    const receivedMarkup = renderActions(
      { ...baseRequest, status: "RECEIVED" },
      { canApprove: false, canUpdate: false, canVerify: true },
    );
    const noPermissionMarkup = renderActions(
      { ...baseRequest, status: "ORDERED" },
      { canApprove: false, canUpdate: false, canVerify: false },
    );

    expect(orderedMarkup).toContain("Verifikasi Sampai");
    expect(approvedMarkup).toContain("Verifikasi Sampai");
    expect(receivedMarkup).not.toContain("Verifikasi Sampai");
    expect(noPermissionMarkup).not.toContain("Verifikasi Sampai");
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

    expect(nomorColumn?.minWidth).toBe("18rem");
    expect(gudangColumn?.minWidth).toBe("14rem");
    expect(keteranganColumn?.minWidth).toBe("16rem");
    expect(statusColumn?.align).toBe("center");
    expect(statusColumn?.className).toContain("w-[10rem]");
    expect(actionColumn?.align).toBe("right");
    expect(actionColumn?.className).toContain("w-[16rem]");
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
        onApprove={vi.fn()}
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
        onApprove={vi.fn()}
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
    expect(markup).toContain('aria-label="Download PR PR-001"');
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
    expect(markup).toContain("Approve");
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
});
