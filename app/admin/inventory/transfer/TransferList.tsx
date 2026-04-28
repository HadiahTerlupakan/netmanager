"use client";
import { clientLogger } from "@/lib/client-logger";

import { useState, useEffect, useCallback } from "react";
import { TransferForm } from "@/components/inventory/TransferForm";
import { TransferTable } from "@/components/inventory/TransferTable";
import { Modal } from "@/components/ui/Modal";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import Image from "next/image";
import { usePermission } from "@/hooks/use-permission";
import { getWithAuth } from "@/lib/api-client";

interface Transfer {
  id: string;
  kodeTransfer: string;
  tanggal: string;
  barangId: string;
  jumlah: number;
  kondisi: "BARU" | "BEKAS" | "RUSAK";
  keterangan?: string;
  fotoBukti?: string[];
  barang?: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
  };
  dariGudang?: {
    kode: string;
    nama: string;
    lokasi?: string;
  };
  keGudang?: {
    kode: string;
    nama: string;
    lokasi?: string;
  };
  createdBy?: {
    name: string;
  };
  keluar?: {
    tanggal: string;
    keterangan: string;
  };
  masuk?: {
    tanggal: string;
    keterangan: string;
  };
}

export async function fetchTransferDetail(
  request: typeof getWithAuth,
  transferId: string,
): Promise<Transfer> {
  const response = await request(`/api/inventory/transfer/${transferId}`);
  const jsonResponse = await response.json();

  if (!jsonResponse.success) {
    throw new Error(jsonResponse.error || "Gagal memuat detail transfer");
  }

  const result = jsonResponse.data || jsonResponse;
  return result.transfer || result;
}

export default function TransferPage() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("transfer:create");

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(
    null,
  );
  const [showDetails, setShowDetails] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // ImageLightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fetchTransfers = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError("");
        const response = await getWithAuth(
          `/api/inventory/transfer?page=${page}&limit=${pagination.limit}`,
        );
        const jsonResponse = await response.json();

        if (!jsonResponse.success) {
          throw new Error(jsonResponse.error || "Gagal memuat data transfer");
        }

        // Handle various response structures
        const result = jsonResponse.data || jsonResponse;
        const transferList =
          result.transferList ||
          result.transfers ||
          (Array.isArray(result) ? result : []);

        setTransfers(transferList);
        setPagination((prev) => ({
          ...prev,
          page,
          total: result.pagination?.total || result.meta?.total || 0,
          totalPages:
            result.pagination?.totalPages || result.meta?.totalPages || 0,
        }));
      } catch (error: unknown) {
        clientLogger.error("Error fetching transfers:", error);
        setError(error instanceof Error ? error.message : "Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit],
  );

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleViewDetails = async (transfer: Transfer) => {
    try {
      setError("");
      const detailTransfer = await fetchTransferDetail(
        getWithAuth,
        transfer.id,
      );
      setSelectedTransfer(detailTransfer);
      setShowDetails(true);
    } catch (error: unknown) {
      clientLogger.error("Error fetching transfer detail:", error);
      setError(error instanceof Error ? error.message : "Terjadi kesalahan");
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchTransfers(newPage);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
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

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
          <button
            onClick={() => fetchTransfers()}
            className="ml-2 text-red-600 underline hover:text-red-800"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Transfers List */}
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
                onRefresh={() => fetchTransfers(pagination.page)}
                onViewDetails={handleViewDetails}
                onDelete={() => {}} // This is handled in the table component
              />

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Menampilkan {(pagination.page - 1) * pagination.limit + 1}{" "}
                    hingga{" "}
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total,
                    )}{" "}
                    dari {pagination.total} data
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm">
                      Halaman {pagination.page} dari {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Transfer Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Transfer Barang Antar Gudang"
        size="lg"
      >
        <TransferForm
          onClose={() => setShowForm(false)}
          onSuccess={() => fetchTransfers(1)} // Refresh first page on success
        />
      </Modal>

      {/* Transfer Details Modal */}
      <Modal
        isOpen={showDetails && !!selectedTransfer}
        onClose={() => {
          setShowDetails(false);
          setSelectedTransfer(null);
        }}
        title="Detail Transfer"
        size="lg"
      >
        {selectedTransfer && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Kode Transfer
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedTransfer.kodeTransfer}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tanggal
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(selectedTransfer.tanggal).toLocaleString("id-ID")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Barang
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedTransfer.barang?.kode} -{" "}
                    {selectedTransfer.barang?.nama}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Jumlah
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedTransfer.jumlah} {selectedTransfer.barang?.satuan}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Kondisi
                  </p>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      selectedTransfer.kondisi === "BARU"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                        : selectedTransfer.kondisi === "BEKAS"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                    }`}
                  >
                    {selectedTransfer.kondisi}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Diproses Oleh
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      {selectedTransfer.createdBy?.name?.charAt(0) || "?"}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {selectedTransfer.createdBy?.name || "System"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">
                  Gudang Sumber
                </p>
                <p className="font-medium text-red-900 dark:text-red-300">
                  {selectedTransfer.dariGudang?.kode} -{" "}
                  {selectedTransfer.dariGudang?.nama}
                </p>
                {selectedTransfer.dariGudang?.lokasi && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {selectedTransfer.dariGudang?.lokasi}
                  </p>
                )}
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-2">
                  Gudang Tujuan
                </p>
                <p className="font-medium text-green-900 dark:text-green-300">
                  {selectedTransfer.keGudang?.kode} -{" "}
                  {selectedTransfer.keGudang?.nama}
                </p>
                {selectedTransfer.keGudang?.lokasi && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    {selectedTransfer.keGudang?.lokasi}
                  </p>
                )}
              </div>
            </div>

            {selectedTransfer.keterangan && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Keterangan
                </p>
                <p className="text-gray-900 dark:text-white">
                  {selectedTransfer.keterangan}
                </p>
              </div>
            )}

            {/* Foto Bukti */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Foto Bukti
              </p>
              {selectedTransfer.fotoBukti &&
              selectedTransfer.fotoBukti.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedTransfer.fotoBukti.length} foto terlampir
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedTransfer.fotoBukti.map(
                      (url: string, index: number) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setLightboxIndex(index);
                            setLightboxOpen(true);
                          }}
                          className="relative overflow-hidden rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer hover:border-blue-500 transition-colors group aspect-square"
                        >
                          <Image
                            src={url}
                            alt={`Foto bukti ${index + 1}`}
                            fill
                            className="object-cover"
                            loading="eager"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <svg
                              className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                              />
                            </svg>
                          </div>
                        </button>
                      ),
                    )}
                  </div>
                  <ImageLightbox
                    images={selectedTransfer.fotoBukti}
                    initialIndex={lightboxIndex}
                    isOpen={lightboxOpen}
                    onClose={() => setLightboxOpen(false)}
                    alt="Foto Bukti Transfer"
                  />
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <svg
                    className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tidak ada foto bukti
                  </p>
                </div>
              )}
            </div>

            {/* Related Transactions */}
            {(selectedTransfer.masuk || selectedTransfer.keluar) && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Transaksi Terkait
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="space-y-2">
                    {selectedTransfer.keluar && (
                      <div className="flex items-center space-x-2">
                        <span className="text-red-600 dark:text-red-400">
                          Keluar:
                        </span>
                        <span className="text-sm">
                          {new Date(
                            selectedTransfer.keluar.tanggal,
                          ).toLocaleString("id-ID")}{" "}
                          - {selectedTransfer.keluar.keterangan}
                        </span>
                      </div>
                    )}
                    {selectedTransfer.masuk && (
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600 dark:text-green-400">
                          Masuk:
                        </span>
                        <span className="text-sm">
                          {new Date(
                            selectedTransfer.masuk.tanggal,
                          ).toLocaleString("id-ID")}{" "}
                          - {selectedTransfer.masuk.keterangan}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
