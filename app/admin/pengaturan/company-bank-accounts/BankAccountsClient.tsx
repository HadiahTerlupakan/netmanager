"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState } from "react";
import {
  HiOutlineBanknotes,
  HiOutlinePlus,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlinePencil,
  HiOutlineTrash,
  HiXMark,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";

interface CompanyBankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
  priority: number;
  description?: string;
  createdAt: string;
}

export function ClientComponent() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<CompanyBankAccount | null>(null);
  const [formData, setFormData] = useState({
    bankName: "",
    accountNumber: "",
    accountName: "",
    description: "",
    isActive: true,
    priority: 1,
  });

  const {
    data: rawAccounts,
    isLoading: loading,
    mutate: fetchAccounts,
  } = useApi<CompanyBankAccount[] | { data: CompanyBankAccount[] }>(
    "/api/admin/company-bank-accounts",
    {
      onError: (error) => {
        clientLogger.error("Error fetching bank accounts:", error);
      },
    },
  );

  const accounts: CompanyBankAccount[] = Array.isArray(rawAccounts)
    ? rawAccounts
    : (rawAccounts?.data ?? []);

  const handleOpenModal = (account?: CompanyBankAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        description: account.description || "",
        isActive: account.isActive,
        priority: account.priority,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        bankName: "",
        accountNumber: "",
        accountName: "",
        description: "",
        isActive: true,
        priority: 1,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const url = editingAccount
        ? `/api/admin/company-bank-accounts/${editingAccount.id}`
        : "/api/admin/company-bank-accounts";

      const response = await fetch(url, {
        method: editingAccount ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert(
          editingAccount
            ? "Rekening berhasil diupdate!"
            : "Rekening berhasil ditambahkan!",
        );
        setModalOpen(false);
        await fetchAccounts();
      } else {
        const error = await response.json();
        alert(`Gagal menyimpan: ${error.error}`);
      }
    } catch (error) {
      clientLogger.error("Error saving account:", error);
      alert("Terjadi kesalahan saat menyimpan");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus rekening ini?")) return;

    try {
      const response = await fetch(`/api/admin/company-bank-accounts/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        alert("Rekening berhasil dihapus!");
        await fetchAccounts();
      } else {
        alert("Gagal menghapus rekening");
      }
    } catch (error) {
      clientLogger.error("Error deleting account:", error);
      alert("Terjadi kesalahan saat menghapus");
    }
  };

  const handleToggleActive = async (account: CompanyBankAccount) => {
    try {
      const response = await fetch(
        `/api/admin/company-bank-accounts/${account.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...account, isActive: !account.isActive }),
        },
      );

      if (response.ok) {
        await fetchAccounts();
      }
    } catch (error) {
      clientLogger.error("Error toggling status:", error);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HiOutlineBanknotes className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Rekening Bank Perusahaan
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Kelola rekening untuk pembayaran manual pelanggan
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => handleOpenModal()}
            variant="default"
          >
            <HiOutlinePlus className="w-5 h-5" />
            Tambah Rekening
          </Button>
        </div>
      </div>

      {/* Bank Accounts List */}
      <div className="max-w-6xl mx-auto">
        {accounts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
            <HiOutlineBanknotes className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Belum ada rekening bank yang ditambahkan
            </p>
            <Button
              type="button"
              onClick={() => handleOpenModal()}
              variant="default"
            >
              Tambah Rekening Pertama
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-2 border-transparent hover:border-blue-500 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {account.bankName}
                      </h3>
                      {account.isActive ? (
                        <HiOutlineCheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <HiOutlineXCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {account.accountName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(account)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title={account.isActive ? "Nonaktifkan" : "Aktifkan"}
                    >
                      {account.isActive ? (
                        <HiOutlineCheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <HiOutlineXCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenModal(account)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <HiOutlinePencil className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(account.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <HiOutlineTrash className="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      No. Rekening:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white font-mono">
                      {account.accountNumber}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Priority:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {account.priority}
                    </span>
                  </div>
                  {account.description && (
                    <div className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Keterangan:
                      </span>
                      <p className="text-gray-700 dark:text-gray-300 mt-1">
                        {account.description}
                      </p>
                    </div>
                  )}
                </div>

                <div
                  className={`text-xs px-3 py-1 rounded-full inline-block ${
                    account.isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {account.isActive ? "Aktif" : "Nonaktif"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingAccount ? "Edit Rekening" : "Tambah Rekening Baru"}
              </h3>
              <Button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2"
                variant="ghost"
                size="icon"
              >
                <HiXMark className="w-6 h-6 text-gray-500" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="bank-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Nama Bank *
                </label>
                <input
                  id="bank-name"
                  type="text"
                  value={formData.bankName}
                  onChange={(e) =>
                    setFormData({ ...formData, bankName: e.target.value })
                  }
                  placeholder="BCA, BRI, Mandiri, BNI, dll"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="account-number"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Nomor Rekening *
                </label>
                <input
                  id="account-number"
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, accountNumber: e.target.value })
                  }
                  placeholder="1234567890"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor="account-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Nama Pemilik Rekening *
                </label>
                <input
                  id="account-name"
                  type="text"
                  value={formData.accountName}
                  onChange={(e) =>
                    setFormData({ ...formData, accountName: e.target.value })
                  }
                  placeholder="PT. Nama Perusahaan"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="account-description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Keterangan (Opsional)
                </label>
                <textarea
                  id="account-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Informasi tambahan untuk pelanggan"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="account-priority"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Priority: {formData.priority}
                </label>
                <input
                  id="account-priority"
                  type="range"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Priority lebih tinggi akan tampil lebih dulu (1-10)
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Status
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Aktifkan rekening untuk pembayaran manual
                  </p>
                </div>
                <label
                  htmlFor="account-is-active"
                  className="relative inline-flex items-center cursor-pointer"
                >
                  <input
                    id="account-is-active"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <Button
                type="button"
                onClick={() => setModalOpen(false)}
                variant="outline"
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={
                  !formData.bankName ||
                  !formData.accountNumber ||
                  !formData.accountName
                }
                variant="default"
                className="flex-1"
              >
                {editingAccount ? "Update" : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
