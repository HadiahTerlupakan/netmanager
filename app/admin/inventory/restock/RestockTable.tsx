"use client";

import type { ReactNode } from "react";
import {
  FiDownload,
  FiEdit2,
  FiEye,
  FiPlus,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";

import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";

import { generatePurchaseOrderPdf } from "./pdf";
import { RestockStatusBadge } from "./RestockStatusBadge";
import {
  canApprovePurchaseRequest,
  canDeletePurchaseRequest,
  canEditPurchaseRequest,
  canReceivePurchaseRequest,
} from "./utils";
import type { PurchaseRequest } from "./types";

interface RestockFilterOption {
  value: string;
  label: string;
}

interface RestockTableProps {
  requests: PurchaseRequest[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: PurchaseRequest["status"] | "all";
  onStatusFilterChange: (value: PurchaseRequest["status"] | "all") => void;
  statusOptions: RestockFilterOption[];
  gudangFilter: string;
  onGudangFilterChange: (value: string) => void;
  gudangOptions: RestockFilterOption[];
  currentPage: number;
  totalPages: number;
  itemsPerPage: number | "all";
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (value: number | "all") => void;
  canApprove: boolean;
  canUpdate: boolean;
  canVerify: boolean;
  onOpenCreate: () => void;
  onOpenEdit: (request: PurchaseRequest) => void;
  onOpenDetail: (request: PurchaseRequest) => void;
  onApprove: (id: string) => void;
  onOpenReceive: (request: PurchaseRequest) => void;
  onOpenConfirmJasa?: (request: PurchaseRequest) => void;
  onDelete: (id: string) => void;
}

interface RestockActionHandlers {
  onOpenEdit: (request: PurchaseRequest) => void;
  onOpenDetail: (request: PurchaseRequest) => void;
  onApprove: (id: string) => void;
  onOpenReceive: (request: PurchaseRequest) => void;
  onOpenConfirmJasa?: (request: PurchaseRequest) => void;
  onDelete: (id: string) => void;
}

interface RestockActionPermissions {
  canApprove: boolean;
  canUpdate: boolean;
  canVerify: boolean;
}

interface RenderRestockActionsInput
  extends RestockActionHandlers, RestockActionPermissions {
  request: PurchaseRequest;
}

function IconActionButton({
  label,
  title,
  className,
  onClick,
  children,
}: {
  label: string;
  title: string;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={label}
      className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-xl p-2 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

function PrimaryActionButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button onClick={onClick} aria-label={label} className={className}>
      {children}
    </button>
  );
}

function renderRestockActions(input: RenderRestockActionsInput) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {renderBaseActions(input.request, input)}
      {renderStatusActions(input.request, input)}
    </div>
  );
}

function renderBaseActions(
  request: PurchaseRequest,
  handlers: RestockActionHandlers,
) {
  return (
    <>
      <IconActionButton
        title="Lihat Detail"
        label={`Lihat detail ${request.nomorRequest}`}
        onClick={() => handlers.onOpenDetail(request)}
        className="text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      >
        <FiEye className="text-[0.95rem]" />
      </IconActionButton>
      <IconActionButton
        title="Download PO"
        label={`Download PO ${request.nomorRequest}`}
        onClick={() => generatePurchaseOrderPdf(request)}
        className="text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      >
        <FiDownload className="text-[0.95rem]" />
      </IconActionButton>
    </>
  );
}

function renderStatusActions(
  request: PurchaseRequest,
  input: RestockActionHandlers & RestockActionPermissions,
) {
  return (
    <>
      {renderEditAction(request, input)}
      {renderApproveAction(request, input)}
      {renderReceiveAction(request, input)}
      {renderConfirmJasaAction(request, input)}
      {renderDeleteAction(request, input)}
    </>
  );
}

function renderEditAction(
  request: PurchaseRequest,
  input: RestockActionHandlers & RestockActionPermissions,
) {
  if (!canEditPurchaseRequest(request.status, input.canUpdate)) return null;

  return (
    <IconActionButton
      title="Edit"
      label={`Edit ${request.nomorRequest}`}
      onClick={() => input.onOpenEdit(request)}
      className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
    >
      <FiEdit2 className="text-[0.95rem]" />
    </IconActionButton>
  );
}

function renderApproveAction(
  request: PurchaseRequest,
  input: RestockActionHandlers & RestockActionPermissions,
) {
  if (!canApprovePurchaseRequest(request.status, input.canApprove)) return null;

  return (
    <PrimaryActionButton
      label={`Approve ${request.nomorRequest}`}
      onClick={() => input.onApprove(request.id)}
      className="inline-flex min-w-[6.75rem] items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black tracking-[-0.02em] text-white transition-all hover:bg-emerald-500"
    >
      Approve
    </PrimaryActionButton>
  );
}

function renderReceiveAction(
  request: PurchaseRequest,
  input: RestockActionHandlers & RestockActionPermissions,
) {
  if (!canReceivePurchaseRequest(request.status, input.canVerify)) return null;

  return (
    <PrimaryActionButton
      label={`Verifikasi barang sampai ${request.nomorRequest}`}
      onClick={() => input.onOpenReceive(request)}
      className="inline-flex min-w-[8.5rem] items-center justify-center rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-black tracking-[-0.02em] text-white transition-all hover:bg-indigo-500"
    >
      Verifikasi Sampai
    </PrimaryActionButton>
  );
}

function renderConfirmJasaAction(
  request: PurchaseRequest,
  input: RestockActionHandlers & RestockActionPermissions,
) {
  if (!input.canVerify || !input.onOpenConfirmJasa) return null;
  const hasPendingJasa = (request.jasaItems ?? []).some(
    (item) => item.statusKonfirmasi === "PENDING",
  );
  if (!hasPendingJasa) return null;
  if (!["APPROVED", "ORDERED", "RECEIVED"].includes(request.status)) {
    return null;
  }

  return (
    <PrimaryActionButton
      label={`Konfirmasi jasa selesai ${request.nomorRequest}`}
      onClick={() => input.onOpenConfirmJasa?.(request)}
      className="inline-flex min-w-[8.5rem] items-center justify-center rounded-xl bg-violet-600 px-3 py-2 text-[11px] font-black tracking-[-0.02em] text-white transition-all hover:bg-violet-500"
    >
      Konfirmasi Jasa
    </PrimaryActionButton>
  );
}

function renderDeleteAction(
  request: PurchaseRequest,
  input: RestockActionHandlers & RestockActionPermissions,
) {
  if (!canDeletePurchaseRequest(request.status, input.canUpdate)) return null;

  return (
    <IconActionButton
      title="Hapus"
      label={`Hapus ${request.nomorRequest}`}
      onClick={() => input.onDelete(request.id)}
      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
    >
      <FiTrash2 className="text-[0.95rem]" />
    </IconActionButton>
  );
}

function renderEmptyMessage(hasActiveFilter: boolean): ReactNode {
  if (hasActiveFilter) {
    return (
      <div className="space-y-1 py-4 text-center">
        <p className="font-black text-gray-700 dark:text-gray-200">
          Tidak ada pengajuan yang cocok dengan filter aktif
        </p>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Ubah kata kunci, status, atau gudang untuk memperluas hasil.
        </p>
      </div>
    );
  }

  return "Belum ada data pengajuan.";
}

export function RestockTable({
  requests,
  loading,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  gudangFilter,
  onGudangFilterChange,
  gudangOptions,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  canApprove,
  canUpdate,
  canVerify,
  onOpenCreate,
  onOpenEdit,
  onOpenDetail,
  onApprove,
  onOpenReceive,
  onDelete,
}: RestockTableProps) {
  const hasActiveFilter = Boolean(
    search.trim() || statusFilter !== "all" || gudangFilter !== "all",
  );

  const renderActions = (request: PurchaseRequest) =>
    renderRestockActions({
      request,
      canApprove,
      canUpdate,
      canVerify,
      onOpenEdit,
      onOpenDetail,
      onApprove,
      onOpenReceive,
      onDelete,
    });

  const renderMobileCard = (request: PurchaseRequest) => (
    <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-black tracking-[-0.03em] text-gray-900 dark:text-white">
            {request.nomorRequest}
          </p>
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            Tgl. Pengajuan:{" "}
            {new Date(request.createdAt).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <RestockStatusBadge status={request.status} />
      </div>
      <div className="mt-4 space-y-2 rounded-2xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
        <div>Gudang: {request.gudang?.nama || "-"}</div>
        <div className="font-medium text-gray-500 dark:text-gray-400">
          Catatan: {request.keterangan || "-"}
        </div>
      </div>
      <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
        {renderActions(request)}
      </div>
    </div>
  );

  const columns: Column<PurchaseRequest>[] = [
    {
      key: "nomor",
      header: "No. Pengajuan",
      priority: "primary",
      minWidth: "18rem",
      render: (request) => (
        <span className="text-sm font-black tracking-[-0.03em] text-gray-900 dark:text-white">
          {request.nomorRequest}
        </span>
      ),
    },
    {
      key: "tanggalPengajuan",
      header: "Tanggal Pengajuan",
      priority: "secondary",
      minWidth: "11rem",
      render: (request) => (
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {new Date(request.createdAt).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "gudang",
      header: "Gudang Tujuan",
      priority: "secondary",
      minWidth: "14rem",
      render: (request) => (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {request.gudang?.nama || "-"}
        </span>
      ),
    },
    {
      key: "keterangan",
      header: "Catatan / Keterangan",
      priority: "secondary",
      minWidth: "16rem",
      render: (request) =>
        request.keterangan ? (
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300 line-clamp-2">
            {request.keterangan}
          </span>
        ) : (
          <span className="text-xs font-medium text-gray-300 dark:text-gray-600 italic">
            —
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      align: "center",
      className: "w-[10rem]",
      render: (request) => <RestockStatusBadge status={request.status} />,
    },
    {
      key: "actions",
      header: "Aksi",
      priority: "primary",
      align: "right",
      className: "w-[16rem]",
      render: renderActions,
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-[2rem] font-black tracking-[-0.04em] text-gray-900 dark:text-white">
            Pre Request
          </h1>
          <p className="max-w-[42rem] text-sm font-medium text-gray-600 dark:text-gray-400">
            Manajemen pre-request barang &amp; jasa, approval, dan verifikasi
          </p>
        </div>
        <button
          onClick={onOpenCreate}
          className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-[1.75rem] bg-indigo-600 px-5 text-sm font-black tracking-[-0.03em] text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98] md:self-auto"
        >
          <FiPlus className="text-base" /> Buat Pre Request
        </button>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(11rem,0.5fr))] lg:items-end">
        <div className="relative min-w-0">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[0.95rem] text-gray-400" />
          <input
            type="text"
            placeholder="Cari nomor pengajuan..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-12 w-full rounded-[1.5rem] border border-gray-200 bg-white pl-11 pr-4 text-sm font-medium text-gray-800 shadow-sm transition-all placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/40"
          />
        </div>
        <label className="flex flex-col gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-gray-500 dark:text-gray-300">
          Filter status
          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(
                event.target.value as PurchaseRequest["status"] | "all",
              )
            }
            className="h-12 w-full rounded-[1.5rem] border border-gray-200 bg-white px-4 text-sm font-medium normal-case tracking-normal text-gray-800 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/40"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-gray-500 dark:text-gray-300">
          Filter gudang
          <select
            value={gudangFilter}
            onChange={(event) => onGudangFilterChange(event.target.value)}
            className="h-12 w-full rounded-[1.5rem] border border-gray-200 bg-white px-4 text-sm font-medium normal-case tracking-normal text-gray-800 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/40"
          >
            {gudangOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-xl shadow-slate-200/60 dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
        <ResponsiveTable
          data={requests}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage={renderEmptyMessage(hasActiveFilter)}
          renderMobileCard={renderMobileCard}
          page={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={onPageChange}
          onItemsPerPageChange={onItemsPerPageChange}
        />
      </div>
    </>
  );
}
