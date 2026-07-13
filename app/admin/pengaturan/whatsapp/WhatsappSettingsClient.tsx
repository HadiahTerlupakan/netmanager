"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect, useCallback } from "react";
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineCog6Tooth,
  HiOutlineDevicePhoneMobile,
  HiOutlineArrowPath,
  HiOutlineQrCode,
  HiOutlineStopCircle,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";

interface WhatsAppAccount {
  id: string;
  name: string;
  phone: string;
  provider: "WABLAS" | "FONNTE" | "MPWA" | "BAILEYS" | "OFFICIAL";
  accountType: "CUSTOMER" | "INTERNAL";
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  dailyLimit?: number;
  dailyCount: number;
  createdAt: string;
  domain?: string | null;
  deviceId?: string | null;
}

interface BaileysStatus {
  sessionId: string;
  status: "disconnected" | "connecting" | "qr" | "connected";
  qr?: string;
  phone?: string;
}

const PROVIDERS = [
  { id: "WABLAS", name: "Wablas" },
  { id: "FONNTE", name: "Fonnte" },
  { id: "MPWA", name: "MPWA Gateway" },
  { id: "BAILEYS", name: "Baileys (Self-hosted)" },
  {
    id: "OFFICIAL",
    name: "Official WhatsApp Business API (Coming Soon)",
    disabled: true,
  },
];

export function ClientComponent() {
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<WhatsAppAccount | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    data: rawAccounts,
    isLoading: loading,
    mutate: fetchAccounts,
  } = useApi<WhatsAppAccount[]>("/api/admin/whatsapp/accounts", {
    onError: (err) => {
      clientLogger.error("Error fetching WhatsApp accounts:", err);
      setError("Gagal memuat akun WhatsApp");
    },
  });

  const accounts: WhatsAppAccount[] = rawAccounts ?? [];

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus akun ini?")) return;

    try {
      const response = await fetch(`/api/admin/whatsapp/accounts/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("Akun berhasil dihapus");
        await fetchAccounts();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Gagal menghapus akun");
      }
    } catch (error) {
      clientLogger.error("Error deleting account:", error);
      setError("Gagal menghapus akun");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch(
        `/api/admin/whatsapp/accounts/${id}/set-default`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        setSuccess("Akun berhasil diset sebagai default");
        await fetchAccounts();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Gagal set default");
      }
    } catch (error) {
      clientLogger.error("Error setting default:", error);
      setError("Gagal set default");
    }
  };

  const handleTest = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/whatsapp/accounts/${id}/test`, {
        method: "POST",
      });

      if (response.ok) {
        setSuccess("Test koneksi berhasil! Periksa WhatsApp Anda.");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Test koneksi gagal");
      }
    } catch (error) {
      clientLogger.error("Error testing connection:", error);
      setError("Test koneksi gagal");
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
          <div>
            <div className="flex items-center gap-3 mb-2">
              <HiOutlineCog6Tooth className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                WhatsApp Accounts
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Kelola multiple akun WhatsApp untuk pengiriman pesan
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setShowModal(true);
            }}
            variant="default"
          >
            <HiOutlinePlus className="w-5 h-5" />
            Tambah Akun
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="max-w-6xl mx-auto mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
            <HiOutlineCheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            <span className="text-green-800 dark:text-green-200">
              {success}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-6xl mx-auto mb-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
            <HiOutlineXCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            <span className="text-red-800 dark:text-red-200">{error}</span>
          </div>
        </div>
      )}

      {/* Accounts List */}
      <div className="max-w-6xl mx-auto">
        {accounts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
            <HiOutlineDevicePhoneMobile className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Belum ada akun WhatsApp
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Tambahkan akun WhatsApp pertama Anda untuk mulai mengirim pesan
            </p>
            <Button
              type="button"
              onClick={() => {
                setEditingAccount(null);
                setShowModal(true);
              }}
              variant="default"
            >
              <HiOutlinePlus className="w-5 h-5" />
              Tambah Akun Pertama
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {account.name}
                      </h3>
                      {account.isDefault && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded">
                          Default
                        </span>
                      )}
                      {account.accountType === "INTERNAL" && (
                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-medium rounded">
                          Internal
                        </span>
                      )}
                      {!account.isActive && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 text-xs font-medium rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <p>
                        <span className="font-medium">Phone:</span>{" "}
                        {account.phone}
                      </p>
                      <p>
                        <span className="font-medium">Provider:</span>{" "}
                        {PROVIDERS.find((p) => p.id === account.provider)?.name}
                      </p>
                      <p>
                        <span className="font-medium">Type:</span>{" "}
                        {account.accountType === "CUSTOMER"
                          ? "Customer"
                          : "Internal"}
                      </p>
                      <p>
                        <span className="font-medium">Priority:</span>{" "}
                        {account.priority}
                      </p>
                      {account.dailyLimit && (
                        <p>
                          <span className="font-medium">Daily Usage:</span>{" "}
                          {account.dailyCount} / {account.dailyLimit}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => handleTest(account.id)}
                      variant="ghost"
                      size="icon"
                      title="Test Connection"
                    >
                      <HiOutlineArrowPath className="w-5 h-5" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setEditingAccount(account);
                        setShowModal(true);
                      }}
                      variant="ghost"
                      size="icon"
                      title="Edit"
                    >
                      <HiOutlinePencil className="w-5 h-5" />
                    </Button>
                    {!account.isDefault && (
                      <Button
                        type="button"
                        onClick={() => handleSetDefault(account.id)}
                        variant="ghost"
                        size="sm"
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={() => handleDelete(account.id)}
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <HiOutlineTrash className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {account.provider === "BAILEYS" && (
                  <BaileysPanel accountId={account.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <AccountModal
          account={editingAccount}
          onClose={() => {
            setShowModal(false);
            setEditingAccount(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingAccount(null);
            void fetchAccounts();
            setSuccess(
              editingAccount
                ? "Akun berhasil diupdate"
                : "Akun berhasil ditambahkan",
            );
            setTimeout(() => setSuccess(null), 3000);
          }}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  );
}

// Modal Component
function AccountModal({
  account,
  onClose,
  onSuccess,
  onError,
}: {
  account: WhatsAppAccount | null;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: account?.name || "",
    phone: account?.phone || "",
    provider: account?.provider || "FONNTE",
    accountType: account?.accountType || "CUSTOMER",
    apiKey: "",
    domain: account?.domain || "",
    deviceId: account?.deviceId || "",
    isActive: account?.isActive ?? true,
    priority: account?.priority || 0,
    dailyLimit: account?.dailyLimit || undefined,
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = account
        ? `/api/admin/whatsapp/accounts/${account.id}`
        : "/api/admin/whatsapp/accounts";
      const method = account ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        name: formData.name,
        phone: formData.phone,
        provider: formData.provider,
        accountType: formData.accountType,
        isActive: formData.isActive,
        priority: formData.priority,
      };

      if (formData.apiKey) body.apiKey = formData.apiKey;
      if (formData.domain) body.domain = formData.domain;
      if (formData.deviceId) body.deviceId = formData.deviceId;
      if (formData.dailyLimit) body.dailyLimit = formData.dailyLimit;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        onError(data.error || "Gagal menyimpan akun");
      }
    } catch (error) {
      clientLogger.error("Error saving account:", error);
      onError("Gagal menyimpan akun");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {account ? "Edit Akun WhatsApp" : "Tambah Akun WhatsApp"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nama Akun *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="CS Team, Marketing, dll"
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nomor WhatsApp *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="628123456789"
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Provider *
              </label>
              <select
                value={formData.provider}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    provider: e.target.value as
                      | "WABLAS"
                      | "FONNTE"
                      | "MPWA"
                      | "BAILEYS"
                      | "OFFICIAL",
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.disabled}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipe Akun *
              </label>
              <select
                value={formData.accountType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    accountType: e.target.value as "CUSTOMER" | "INTERNAL",
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="CUSTOMER">
                  Customer - Untuk pesan ke pelanggan
                </option>
                <option value="INTERNAL">
                  Internal - Untuk notifikasi approval & reminder
                </option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formData.accountType === "CUSTOMER"
                  ? "Digunakan untuk mengirim pesan ke pelanggan (invoice, reminder, broadcast)"
                  : "Digunakan untuk notifikasi internal (approval lembur, izin, work order)"}
              </p>
            </div>

            {(formData.provider === "WABLAS" ||
              formData.provider === "MPWA") && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Domain / Base URL
                  </label>
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(e) =>
                      setFormData({ ...formData, domain: e.target.value })
                    }
                    placeholder={
                      formData.provider === "MPWA"
                        ? "https://wagateway.example.com"
                        : "console.wablas.com"
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Device ID / Sender Number
                  </label>
                  <input
                    type="text"
                    value={formData.deviceId}
                    onChange={(e) =>
                      setFormData({ ...formData, deviceId: e.target.value })
                    }
                    placeholder={
                      formData.provider === "MPWA" ? "62888xxxx" : "Device ID"
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {formData.provider === "BAILEYS" ? (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
                Baileys self-hosted: tidak butuh API key. Setelah simpan, buka
                panel session di kartu akun → Start → scan QR dengan WhatsApp.
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key / Token {!account && "*"}
                </label>
                <input
                  type="text"
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, apiKey: e.target.value })
                  }
                  placeholder={
                    account
                      ? "Kosongkan jika tidak ingin ubah"
                      : formData.provider === "WABLAS"
                        ? "token.secret_key (dari Device → Settings)"
                        : "API Key"
                  }
                  required={!account}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                {formData.provider === "WABLAS" && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Wablas: isi dengan format{" "}
                    <span className="font-mono">token.secret_key</span> —
                    keduanya dari Device → Settings. Tanpa secret_key, Wablas
                    menolak dengan &quot;IP not authorized&quot;.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value ? Number(e.target.value) : 0,
                    })
                  }
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Semakin tinggi, semakin prioritas
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Daily Limit
                </label>
                <input
                  type="number"
                  value={formData.dailyLimit || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dailyLimit: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  min="1"
                  placeholder="Unlimited"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Kosongkan untuk unlimited
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="isActive"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Aktif
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={saving}
                variant="default"
                className="flex-1"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function BaileysPanel({ accountId }: { accountId: string }) {
  const [info, setInfo] = useState<BaileysStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/whatsapp/accounts/${accountId}/baileys`,
      );
      const json = (await res.json()) as {
        success: boolean;
        data?: BaileysStatus;
        error?: string;
      };
      if (json.success && json.data) {
        setInfo(json.data);
        setPanelError(null);
      } else {
        setPanelError(json.error ?? "Gagal ambil status Baileys");
      }
    } catch (err) {
      clientLogger.error("BaileysPanel fetchStatus error:", err);
      setPanelError(err instanceof Error ? err.message : "Network error");
    }
  }, [accountId]);

  useEffect(() => {
    const initial = setTimeout(() => void fetchStatus(), 0);
    const t = setInterval(() => void fetchStatus(), 4000);
    return () => {
      clearTimeout(initial);
      clearInterval(t);
    };
  }, [fetchStatus]);

  const doAction = async (action: "start" | "stop" | "restart") => {
    setLoading(true);
    setPanelError(null);
    try {
      const res = await fetch(
        `/api/admin/whatsapp/accounts/${accountId}/baileys`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const json = (await res.json()) as {
        success: boolean;
        data?: BaileysStatus;
        error?: string;
      };
      if (json.success && json.data) {
        setInfo(json.data);
        if (action === "start" || action === "restart") {
          setTimeout(() => void fetchStatus(), 1500);
          setTimeout(() => void fetchStatus(), 4000);
        }
      } else {
        setPanelError(json.error ?? `Aksi ${action} gagal`);
        clientLogger.error("BaileysPanel doAction error:", json.error);
      }
    } catch (err) {
      clientLogger.error("BaileysPanel doAction exception:", err);
      setPanelError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const statusColor = {
    disconnected:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    connecting:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    qr: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    connected:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-3">
        <HiOutlineQrCode className="w-5 h-5 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Baileys Session
        </span>
        {info && (
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor[info.status]}`}
          >
            {info.status}
          </span>
        )}
        {info?.phone && (
          <span className="text-xs text-gray-500">+{info.phone}</span>
        )}
        <div className="ml-auto flex gap-2">
          {(!info || info.status === "disconnected") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => doAction("start")}
              disabled={loading}
            >
              Start
            </Button>
          )}
          {info && info.status !== "disconnected" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => doAction("restart")}
                disabled={loading}
              >
                <HiOutlineArrowPath className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => doAction("stop")}
                disabled={loading}
                className="text-red-600 dark:text-red-400"
              >
                <HiOutlineStopCircle className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      {panelError && (
        <div className="mb-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-2 text-xs text-red-700 dark:text-red-300">
          {panelError}
        </div>
      )}
      {info?.status === "qr" && info.qr && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Scan QR ini dengan WhatsApp di HP kamu
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR is a base64 data URL */}
          <img
            src={info.qr}
            alt="QR Code"
            className="w-48 h-48 rounded-lg border border-gray-200 dark:border-gray-700"
          />
        </div>
      )}
      {info?.status === "connecting" && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Menghubungkan... tunggu QR muncul (polling tiap 4 detik).
        </p>
      )}
    </div>
  );
}
