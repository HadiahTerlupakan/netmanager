"use client";

import { Modal } from "@/components/ui/Modal";
import type { Mitra, MitraTransaction } from "./types";
import { formatCurrency } from "./types";

interface WalletBalance {
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
}

interface WalletTransactions {
  transactions: MitraTransaction[];
  total: number;
}

export interface WalletData {
  balance: WalletBalance | null;
  transactions: WalletTransactions | null;
}

export interface AdjustmentForm {
  amount: string;
  description: string;
}

export interface MitraWalletModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly selectedMitra: Mitra | null;
  readonly walletData: WalletData | null;
  readonly canUpdate: boolean;
  readonly adjusting: boolean;
  readonly adjustmentForm: AdjustmentForm;
  readonly setAdjustmentForm: React.Dispatch<
    React.SetStateAction<AdjustmentForm>
  >;
  readonly onAdjustment: () => void;
}

export function MitraWalletModal({
  isOpen,
  onClose,
  selectedMitra,
  walletData,
  canUpdate,
  adjusting,
  adjustmentForm,
  setAdjustmentForm,
  onAdjustment,
}: MitraWalletModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Wallet — ${selectedMitra?.name || ""}`}
      size="lg"
    >
      {!walletData ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Balance Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Saldo
              </p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
                {formatCurrency(walletData.balance?.balance || 0)}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total Earning
              </p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {formatCurrency(walletData.balance?.totalEarnings || 0)}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total WD
              </p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                {formatCurrency(walletData.balance?.totalWithdrawn || 0)}
              </p>
            </div>
          </div>

          {/* Recent Transactions */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Transaksi Terakhir
            </h4>
            {walletData.transactions?.transactions &&
            walletData.transactions.transactions.length > 0 ? (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-48 overflow-y-auto">
                {walletData.transactions.transactions.map(
                  (tx: MitraTransaction) => (
                    <div
                      key={tx.id}
                      className="px-4 py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {tx.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                Belum ada transaksi
              </p>
            )}
          </div>

          {/* Admin Adjustment */}
          {canUpdate && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Penyesuaian Saldo (Admin)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Jumlah (positif/negatif)"
                  value={adjustmentForm.amount}
                  onChange={(e) =>
                    setAdjustmentForm((f) => ({
                      ...f,
                      amount: e.target.value,
                    }))
                  }
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <input
                  type="text"
                  placeholder="Deskripsi"
                  value={adjustmentForm.description}
                  onChange={(e) =>
                    setAdjustmentForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <button
                onClick={onAdjustment}
                disabled={adjusting}
                className="mt-2 px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {adjusting ? "Memproses..." : "Terapkan Penyesuaian"}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
