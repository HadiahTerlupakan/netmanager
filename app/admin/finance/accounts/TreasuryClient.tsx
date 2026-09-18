"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineBuildingLibrary,
  HiOutlineBanknotes,
  HiOutlineCreditCard,
  HiOutlinePlus,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import TransferModal from "./TransferModal";
import AddAccountModal from "./AddAccountModal";
import clsx from "clsx";
import { usePermission } from "@/hooks/use-permission";
import {
  TREASURY_ACCOUNT_CREATE_PERMISSIONS,
  TREASURY_TRANSFER_PERMISSIONS,
} from "@/lib/financial-write-permissions";
import type { Account } from "@/types";

interface TreasuryClientProps {
  accounts: Account[];
}

export default function TreasuryClient({ accounts }: TreasuryClientProps) {
  const router = useRouter();
  const { hasPermission } = usePermission();

  // Gerbang tombol memakai konstanta yang sama dengan route-nya, dan dinilai
  // OR seperti createHandler. Sebelumnya keduanya dijaga `expense:create`
  // sementara API menuntut `treasury:*`, jadi tombol bisa tampil untuk
  // pengguna yang pasti ditolak server — dan sebaliknya.
  const hasAnyPermission = (permissions: string[]) =>
    permissions.some((permission) => hasPermission(permission));
  const canCreateAccount = hasAnyPermission(
    TREASURY_ACCOUNT_CREATE_PERMISSIONS,
  );
  const canTransferFunds = hasAnyPermission(TREASURY_TRANSFER_PERMISSIONS);

  const [modalOpen, setModalOpen] = useState(false);
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "BANK":
        return <HiOutlineBuildingLibrary className="w-6 h-6" />;
      case "CASH":
        return <HiOutlineBanknotes className="w-6 h-6" />;
      case "EWALLET":
        return <HiOutlineCreditCard className="w-6 h-6" />;
      default:
        return <HiOutlineBanknotes className="w-6 h-6" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "BANK":
        return "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300";
      case "CASH":
        return "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300";
      case "EWALLET":
        return "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const handleTransferSuccess = () => {
    router.refresh();
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Transfer Modal */}
      <TransferModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleTransferSuccess}
        accounts={accounts}
      />

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={addAccountModalOpen}
        onClose={() => setAddAccountModalOpen(false)}
        onSuccess={handleTransferSuccess}
      />

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Kas & Bank (Treasury)
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Kelola akun kas, bank, dan monitor saldo perusahaan.
          </p>
        </div>
        <div>
          {canTransferFunds && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-xs"
            >
              <HiOutlinePlus className="w-5 h-5 text-gray-500" />
              Mutasi Saldo
            </button>
          )}
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-linear-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
          <p className="text-indigo-100 font-medium mb-1 relative z-10">
            Total Saldo Likuid
          </p>
          <h2 className="text-4xl font-bold mb-4 relative z-10">
            {formatCurrency(totalBalance)}
          </h2>
          <div className="text-sm text-indigo-100 relative z-10 flex items-center gap-2">
            <span className="bg-white/20 px-2 py-1 rounded-lg text-xs font-semibold">
              {accounts.length} Akun Aktif
            </span>
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Daftar Akun Keuangan
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={clsx("p-3 rounded-lg", getColor(acc.type))}>
                  {getIcon(acc.type)}
                </div>
                <div className="text-xs font-bold px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {acc.type}
                </div>
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 transition-colors">
                {acc.name}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 font-mono">
                {acc.accountNumber || "-"}
              </p>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Saldo Saat Ini
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(acc.balance)}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Add Account Placeholder */}
        {canCreateAccount && (
          <Button
            variant="ghost"
            onClick={() => setAddAccountModalOpen(true)}
            className="border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center min-h-[240px] w-full"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 group-hover:text-blue-600 flex items-center justify-center mb-3 transition-colors">
              <HiOutlinePlus className="w-6 h-6" />
            </div>
            <span className="font-semibold text-gray-600 dark:text-gray-300 group-hover:text-blue-600">
              Tambah Akun Baru
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Rekening Bank, E-Wallet, atau Kas
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
