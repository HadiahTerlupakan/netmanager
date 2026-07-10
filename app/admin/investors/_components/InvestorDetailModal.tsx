"use client";

import { Modal } from "@/components/ui/Modal";
import PageLoader from "@/components/ui/PageLoader";
import type { InvestorDetail } from "@/modules/investor/dto";

interface InvestorDetailModalProps {
  isOpen: boolean;
  loading: boolean;
  data: InvestorDetail | null;
  onClose: () => void;
  onCreatePayout: () => void;
}

export function InvestorDetailModal({
  isOpen,
  loading,
  data,
  onClose,
  onCreatePayout,
}: InvestorDetailModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detail Investor" size="lg">
      <div className="min-h-[300px] p-2">
        {loading ? (
          <PageLoader
            variant="section"
            message="Memuat informasi lengkap investor..."
          />
        ) : data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <p className="text-sm text-gray-500">Nama Lengkap</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {data.namaLengkap}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Telepon / Email</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {data.noTelp || "-"} / {data.email || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Perusahaan</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {data.perusahaan || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span
                  className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${data.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                >
                  {data.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-md font-bold text-gray-900 dark:text-white mb-3">
                Daftar Proyek RAB yang didanai ({data.rabProjects?.length || 0})
              </h4>
              {data.rabProjects && data.rabProjects.length > 0 ? (
                <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                  {data.rabProjects.map((rp) => (
                    <div
                      key={rp.id}
                      className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h5 className="font-bold text-gray-900 dark:text-white">
                            {rp.rabProject?.name}
                          </h5>
                          <p className="text-xs text-gray-500">
                            Site: {rp.rabProject?.site?.name || "Global"}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                          Bagi Hasil: {rp.profitSharePercent}%
                        </span>
                      </div>
                      <div className="mt-3 flex justify-between text-sm">
                        <span className="text-gray-500">Nilai Investasi:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          Rp{" "}
                          {Number(rp.investmentAmount).toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  Belum ada proyek yang didanai.
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-3 mt-4">
                <h4 className="text-md font-bold text-gray-900 dark:text-white">
                  Riwayat Payout Terakhir
                </h4>
                <button
                  onClick={onCreatePayout}
                  className="text-xs font-semibold bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition"
                >
                  Catat Payout Baru
                </button>
              </div>
              {data.payouts && data.payouts.length > 0 ? (
                <div className="space-y-3 max-h-[150px] overflow-y-auto custom-scrollbar">
                  {data.payouts.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">
                            Rp {Number(p.amount).toLocaleString("id-ID")}
                          </span>
                          <p className="text-xs text-gray-500 uppercase">
                            {new Date(p.date).toLocaleDateString("id-ID")} -{" "}
                            {p.bankName || "Transfer Bank"}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic mb-2">
                  Belum ada riwayat payout.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-red-500">
            Gagal memuat data.
          </div>
        )}
      </div>
    </Modal>
  );
}
