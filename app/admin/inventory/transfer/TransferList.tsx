"use client";

import { useState } from "react";

import { TransferForm } from "@/components/inventory/TransferForm";
import { TransferTable } from "@/components/inventory/TransferTable";
import { TransferDetailModal } from "@/components/inventory/transfer/TransferDetailModal";
import { TransferPagination } from "@/components/inventory/transfer/TransferPagination";
import {
  fetchTransferDetail,
  type Transfer,
  useTransferList,
} from "@/components/inventory/transfer";
import { Modal } from "@/components/ui/Modal";
import { usePermission } from "@/hooks/use-permission";
import { useToast } from "@/hooks/use-toast";
import { getWithAuth } from "@/lib/api-client";
import { clientLogger } from "@/lib/client-logger";

// Re-export untuk kompatibilitas test eksternal yang import dari path ini.
export { fetchTransferDetail };
export type { Transfer };

export default function TransferPage() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("transfer:create");
  const { showToast } = useToast();

  const {
    transfers,
    pagination,
    loading,
    error,
    refresh,
    refreshFirstPage,
    handlePageChange,
  } = useTransferList();

  const [showForm, setShowForm] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(
    null,
  );
  const [showDetails, setShowDetails] = useState(false);

  const handleViewDetails = async (transfer: Transfer) => {
    try {
      const detailTransfer = await fetchTransferDetail(
        getWithAuth,
        transfer.id,
      );
      setSelectedTransfer(detailTransfer);
      setShowDetails(true);
    } catch (err: unknown) {
      clientLogger.error("Error fetching transfer detail:", err);
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal memuat detail transfer",
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Transfer Antar Gudang
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Kelola pemindahan barang antar gudang
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                className="w-4 h-4 mr-2 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-white">Transfer Baru</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-400">
          {error}
          <button
            type="button"
            onClick={() => refresh()}
            className="ml-2 text-red-600 underline hover:text-red-800"
          >
            Coba lagi
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                Memuat data transfer...
              </span>
            </div>
          ) : (
            <>
              <TransferTable
                transfers={transfers}
                onRefresh={() => refresh()}
                onViewDetails={handleViewDetails}
                onDelete={() => {}}
              />

              <TransferPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Transfer Barang Antar Gudang"
        size="lg"
      >
        <TransferForm
          onClose={() => setShowForm(false)}
          onSuccess={() => refreshFirstPage()}
        />
      </Modal>

      <TransferDetailModal
        transfer={selectedTransfer}
        isOpen={showDetails && !!selectedTransfer}
        onClose={() => {
          setShowDetails(false);
          setSelectedTransfer(null);
        }}
      />
    </div>
  );
}
