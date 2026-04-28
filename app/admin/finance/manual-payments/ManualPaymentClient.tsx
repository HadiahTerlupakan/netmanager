"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "react-hot-toast";
import Image from "next/image";

interface PendingPayment {
  id: string;
  amount: string;
  method: string;
  status: string;
  gatewayStatus: string;
  receiptUrl: string;
  createdAt: string;
  customerName?: string;
  notes?: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    pelangganId: string;
    totalAmount: string;
  };
}

export default function ManualPaymentClient() {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(
    null,
  );
  const [processing, setProcessing] = useState(false);
  const [notes, setNotes] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter state
  const getLocalYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return getLocalYMD(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => getLocalYMD(new Date()));
  const [siteId, setSiteId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);

  const fetchOptions = async () => {
    try {
      const res = await fetch("/api/admin/options");
      const json = await res.json();
      if (json.success && json.data) {
        setSites(json.data.sites || []);
      }
    } catch (error) {
      clientLogger.error("Failed to fetch options:", error);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchPendingPayments = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (startDate) query.append("startDate", startDate);
      if (endDate) query.append("endDate", endDate);
      if (siteId) query.append("siteId", siteId);
      if (statusFilter) query.append("status", statusFilter);

      const res = await fetch(
        `/api/admin/payments/pending-manual?${query.toString()}`,
      );
      const json = await res.json();
      if (json.success) {
        setPayments(json.data);
      }
    } catch (error) {
      clientLogger.error("Failed to fetch pending payments:", error);
      toast.error("Gagal mengambil data pembayaran manual.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAction = async (action: "APPROVE" | "REJECT") => {
    if (!selectedPayment) return;

    setProcessing(true);
    try {
      const res = await fetch("/api/admin/payments/verify-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: selectedPayment.id,
          action,
          notes,
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(
          `Pembayaran berhasil di-${action === "APPROVE" ? "setujui" : "tolak"}`,
        );
        setSelectedPayment(null);
        setNotes("");
        fetchPendingPayments();
      } else {
        toast.error(json.error || "Terjadi kesalahan sistem.");
      }
    } catch {
      toast.error("Gagal memproses pembayaran.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Memuat data...</div>;
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-end mb-6">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">
            Dari Tanggal
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">
            Sampai Tanggal
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">
            Pilih Site
          </label>
          <select
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-48 border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Site</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">
            Status Pembayaran
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-48 border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Status</option>
            <option value="PENDING">Menunggu Verifikasi</option>
            <option value="APPROVED">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
          </select>
        </div>
        <Button
          onClick={() => {
            setCurrentPage(1);
            fetchPendingPayments();
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm h-[38px]"
        >
          Terapkan Filter
        </Button>
      </div>

      {payments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-10 text-center border border-gray-100 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            Tidak ada pengajuan pembayaran manual untuk filter ini.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Menunggu Verifikasi
              </p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {payments.filter((p) => p.gatewayStatus === "PENDING").length}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Disetujui
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {
                  payments.filter(
                    (p) =>
                      p.gatewayStatus === "SUCCESS" ||
                      p.gatewayStatus === "PAID",
                  ).length
                }
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ditolak
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {
                  payments.filter(
                    (p) =>
                      p.gatewayStatus === "FAILED" ||
                      p.gatewayStatus === "CANCELLED",
                  ).length
                }
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nominal Disetujui
              </p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                Rp{" "}
                {payments
                  .filter(
                    (p) =>
                      p.gatewayStatus === "SUCCESS" ||
                      p.gatewayStatus === "PAID",
                  )
                  .reduce((sum, p) => sum + Number(p.amount), 0)
                  .toLocaleString("id-ID")}
              </p>
            </div>
          </div>

          {/* Table Layout */}
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Waktu
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Pelanggan & Invoice
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Total Dibayar
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {payments
                    .slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage,
                    )
                    .map((payment) => {
                      const isPending = payment.gatewayStatus === "PENDING";
                      const isSuccess =
                        payment.gatewayStatus === "SUCCESS" ||
                        payment.gatewayStatus === "PAID";
                      const isFailed =
                        payment.gatewayStatus === "FAILED" ||
                        payment.gatewayStatus === "CANCELLED";

                      let statusColor =
                        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
                      let statusText = "Menunggu";

                      if (isSuccess) {
                        statusColor =
                          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
                        statusText = "Disetujui";
                      } else if (isFailed) {
                        statusColor =
                          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
                        statusText = "Ditolak";
                      }

                      return (
                        <tr
                          key={payment.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                            {new Date(payment.createdAt).toLocaleString(
                              "id-ID",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div
                              className="font-bold text-gray-900 dark:text-white"
                              title={
                                payment.customerName ||
                                payment.invoice?.pelangganId
                              }
                            >
                              {payment.customerName ||
                                payment.invoice?.pelangganId}
                            </div>
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                              <span>{payment.invoice?.invoiceNumber}</span>
                              {payment.notes?.includes("⚠️ [AI Peringatan]") &&
                                isPending && (
                                  <span
                                    title="Terdapat Peringatan AI pada Bukti Pembayaran"
                                    className="text-red-500 cursor-help"
                                  >
                                    ⚠️
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            Rp {Number(payment.amount).toLocaleString("id-ID")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColor}`}
                            >
                              {statusText}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <Button
                              size="sm"
                              className={
                                isPending
                                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                  : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                              }
                              onClick={() => setSelectedPayment(payment)}
                            >
                              {isPending ? "Verifikasi" : "Detail"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {Math.ceil(payments.length / itemsPerPage) > 1 && (
              <div className="px-6 py-3 flex flex-col sm:flex-row justify-between items-center border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 gap-3">
                <Button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 disabled:opacity-50 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Sebelumnya
                </Button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Halaman {currentPage} dari{" "}
                  {Math.ceil(payments.length / itemsPerPage)} ({payments.length}{" "}
                  Data)
                </span>
                <Button
                  disabled={
                    currentPage === Math.ceil(payments.length / itemsPerPage)
                  }
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 disabled:opacity-50 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Selanjutnya
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selectedPayment}
        onClose={() => {
          setSelectedPayment(null);
          setNotes("");
        }}
        title={`Verifikasi Pembayaran ${selectedPayment?.invoice?.invoiceNumber}`}
        size="lg"
      >
        {selectedPayment && (
          <div className="space-y-6">
            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-2 text-center overflow-hidden">
              <p className="text-xs text-gray-500 mb-2">
                Bukti Transfer / Pembayaran
              </p>
              <div className="relative w-full h-[300px] md:h-[400px]">
                <Image
                  src={selectedPayment.receiptUrl}
                  alt="Bukti Transfer"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <div className="mt-3">
                <a
                  href={selectedPayment.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-500 hover:underline"
                >
                  Buka Gambar Ukuran Penuh
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                <span className="block text-gray-500 text-xs">
                  Total Dibayar
                </span>
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  Rp {Number(selectedPayment.amount).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                <span className="block text-gray-500 text-xs">
                  Tagihan Seharusnya
                </span>
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  Rp{" "}
                  {Number(selectedPayment.invoice?.totalAmount).toLocaleString(
                    "id-ID",
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Catatan Verifikasi / AI Analisis
              </label>

              {/* Menampilkan Analisis AI sebelumnya jika ada */}
              {selectedPayment.notes && selectedPayment.notes !== notes && (
                <div
                  className={`p-3 rounded-md text-sm border font-medium ${
                    selectedPayment.notes.includes("⚠️ [AI Peringatan]")
                      ? "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                      : "bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                  }`}
                >
                  {selectedPayment.notes}
                </div>
              )}

              {selectedPayment.gatewayStatus === "PENDING" ? (
                <textarea
                  className="w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                  rows={2}
                  placeholder="Contoh: Dana sudah masuk valid / Bukti transfer buram"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              ) : (
                !selectedPayment.notes && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    <i>Tidak ada catatan.</i>
                  </div>
                )
              )}
            </div>

            {selectedPayment.gatewayStatus === "PENDING" && (
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => handleAction("REJECT")}
                  loading={processing}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Tolak Pembayaran
                </Button>
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => handleAction("APPROVE")}
                  loading={processing}
                >
                  Setujui & Lunasi Tagihan
                </Button>
              </div>
            )}
            {selectedPayment.gatewayStatus !== "PENDING" && (
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedPayment(null);
                    setNotes("");
                  }}
                >
                  Tutup
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
