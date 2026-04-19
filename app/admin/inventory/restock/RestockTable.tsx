"use client";

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
  onDelete: (id: string) => void;
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
  const columns: Column<PurchaseRequest>[] = [
    {
      key: "nomor",
      header: "No. Pengajuan",
      priority: "primary",
      minWidth: "18rem",
      render: (request) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-black tracking-[-0.03em] text-gray-900 dark:text-white">
            {request.nomorRequest}
          </span>
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {new Date(request.createdAt).toLocaleDateString("id-ID")}
          </span>
        </div>
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
      render: (request) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => onOpenDetail(request)}
            title="Lihat Detail"
            className="inline-flex min-w-[2.25rem] items-center justify-center rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <FiEye className="text-[0.95rem]" />
          </button>
          <button
            onClick={() => generatePurchaseOrderPdf(request)}
            title="Download PO"
            className="inline-flex min-w-[2.25rem] items-center justify-center rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <FiDownload className="text-[0.95rem]" />
          </button>

          {canEditPurchaseRequest(request.status, canUpdate) && (
            <button
              onClick={() => onOpenEdit(request)}
              title="Edit"
              className="inline-flex min-w-[2.25rem] items-center justify-center rounded-xl p-2 text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              <FiEdit2 className="text-[0.95rem]" />
            </button>
          )}

          {canApprovePurchaseRequest(request.status, canApprove) && (
            <button
              onClick={() => onApprove(request.id)}
              className="inline-flex min-w-[6.75rem] items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black tracking-[-0.02em] text-white transition-all hover:bg-emerald-500"
            >
              Approve
            </button>
          )}

          {canReceivePurchaseRequest(request.status, canVerify) && (
            <button
              onClick={() => onOpenReceive(request)}
              className="inline-flex min-w-[8.5rem] items-center justify-center rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-black tracking-[-0.02em] text-white transition-all hover:bg-indigo-500"
            >
              Verifikasi Sampai
            </button>
          )}

          {canDeletePurchaseRequest(request.status, canUpdate) && (
            <button
              onClick={() => onDelete(request.id)}
              title="Hapus"
              className="inline-flex min-w-[2.25rem] items-center justify-center rounded-xl p-2 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <FiTrash2 className="text-[0.95rem]" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-[2rem] font-black tracking-[-0.04em] text-gray-900 dark:text-white">
            Pengajuan Restock
          </h1>
          <p className="max-w-[42rem] text-sm font-medium text-gray-600 dark:text-gray-400">
            Manajemen pengajuan stok barang, approval, dan verifikasi penerimaan
          </p>
        </div>
        <button
          onClick={onOpenCreate}
          className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-[1.75rem] bg-indigo-600 px-5 text-sm font-black tracking-[-0.03em] text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98] md:self-auto"
        >
          <FiPlus className="text-base" /> Buat Pengajuan Baru
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
          emptyMessage="Belum ada data pengajuan."
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
