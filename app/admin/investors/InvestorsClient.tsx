"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageLoader from "@/components/ui/PageLoader";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import {
  HiOutlinePlus,
  HiOutlineUsers,
  HiOutlineCheckCircle,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlinePower,
  HiOutlineEye,
} from "react-icons/hi2";

interface Investor {
  id: string;
  username: string;
  namaLengkap: string;
  email: string | null;
  noTelp: string | null;
  perusahaan: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    rabProjects: number;
    payouts?: number;
  };
}

interface RabProjectItem {
  id: string;
  profitSharePercent: number;
  investmentAmount: number | string;
  rabProject?: {
    name: string;
    site?: {
      name: string;
    };
  };
}

interface DetailData extends Investor {
  rabProjects?: RabProjectItem[];
  payouts?: Array<{
    id: string;
    amount: string | number;
    date: string | Date;
    bankName?: string | null;
    status: string;
  }>;
}

export default function InvestorsClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("investors:create");

  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canUpdate = hasPermission("investors:update");
  const canDelete = hasPermission("investors:delete");

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "danger" | "warning" | "primary";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: "primary",
  });

  // Form state
  const [form, setForm] = useState({
    username: "",
    password: "",
    namaLengkap: "",
    email: "",
    noTelp: "",
    perusahaan: "",
  });

  const [payoutForm, setPayoutForm] = useState({
    amount: "",
    date: (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })(),
    bankName: "",
    accountNumber: "",
    accountName: "",
    reference: "",
    notes: "",
  });

  const fetchInvestors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/investors`);
      const data = await res.json();

      if (res.ok) {
        setInvestors(data.data || []);
      } else {
        toast.error(data.message || "Gagal memuat data investor");
      }
    } catch {
      toast.error("Terjadi kesalahan saat memuat data investor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  const resetForm = () => {
    setForm({
      username: "",
      password: "",
      namaLengkap: "",
      email: "",
      noTelp: "",
      perusahaan: "",
    });
  };

  const handleAdd = async () => {
    if (!form.username || !form.password || !form.namaLengkap) {
      toast.error("Username, password, dan Nama Lengkap harus diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Investor berhasil ditambahkan");
        setShowAddModal(false);
        resetForm();
        fetchInvestors();
      } else {
        toast.error(data.message || "Gagal menambahkan investor");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const res = await fetch(`/api/admin/investors/${id}/detail`);
      const data = await res.json();
      if (res.ok) {
        setDetailData(data.data);
      } else {
        toast.error(data.message || "Gagal memuat detail investor");
        setShowDetailModal(false);
      }
    } catch {
      toast.error("Terjadi kesalahan");
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSavePayout = async () => {
    if (!payoutForm.amount || isNaN(Number(payoutForm.amount))) {
      toast.error("Nominal harus berupa angka");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/investors/${detailData?.id}/payouts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payoutForm),
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Payout berhasil dicatat");
        setShowPayoutModal(false);
        setPayoutForm({
          amount: "",
          date: (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          })(),
          bankName: "",
          accountNumber: "",
          accountName: "",
          reference: "",
          notes: "",
        });
        handleViewDetail(detailData!.id); // Refresh details
      } else {
        toast.error(data.message || "Gagal mencatat payout");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (inv: Investor) => {
    setForm({
      username: inv.username,
      password: "",
      namaLengkap: inv.namaLengkap,
      email: inv.email || "",
      noTelp: inv.noTelp || "",
      perusahaan: inv.perusahaan || "",
    });
    setEditingId(inv.id);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!form.username || !form.namaLengkap) {
      toast.error("Username dan Nama Lengkap harus diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/investors/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Data Investor berhasil diperbarui");
        setShowEditModal(false);
        resetForm();
        fetchInvestors();
      } else {
        toast.error(data.message || "Gagal memperbarui investor");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    setConfirmModal({
      isOpen: true,
      title: currentStatus ? "Nonaktifkan Investor" : "Aktifkan Investor",
      message: `Apakah Anda yakin ingin ${currentStatus ? "menonaktifkan" : "mengaktifkan"} investor ini?`,
      variant: currentStatus ? "warning" : "primary",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/investors/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !currentStatus }),
          });
          if (res.ok) {
            toast.success("Status Investor berhasil diubah");
            fetchInvestors();
          } else {
            const data = await res.json();
            toast.error(data.message || "Gagal mengubah status");
          }
        } catch {
          toast.error("Terjadi kesalahan");
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Investor Permanen",
      message:
        "Apakah Anda yakin ingin menghapus investor ini? Tindakan ini tidak dapat dibatalkan dan hanya bisa dilakukan jika investor tidak memiliki riwayat proyek atau payout.",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/investors/${id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            toast.success("Investor berhasil dihapus");
            fetchInvestors();
          } else {
            const data = await res.json();
            toast.error(data.message || "Gagal menghapus investor");
          }
        } catch {
          toast.error("Terjadi kesalahan");
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const columns: Column<Investor>[] = [
    {
      key: "namaLengkap",
      header: "Investor",
      priority: "primary",
      render: (inv) => (
        <div className="flex items-center gap-3">
          <div className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-linear-to-br from-emerald-500 to-teal-600">
            <span className="text-white font-bold">
              {inv.namaLengkap.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {inv.namaLengkap}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              @{inv.username}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "perusahaan",
      header: "Institusi/Perusahaan",
      priority: "secondary",
      render: (inv) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {inv.perusahaan || "-"}
        </span>
      ),
    },
    {
      key: "projects",
      header: "Proyek Didanai",
      priority: "primary",
      render: (inv) => (
        <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
          {inv._count?.rabProjects || 0} Proyek
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      priority: "primary",
      render: (inv) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            inv.isActive
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {inv.isActive ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      priority: "primary",
      render: (inv) => (
        <div className="flex items-center justify-end gap-2">
          <button
            title="Lihat Detail"
            onClick={() => handleViewDetail(inv.id)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <HiOutlineEye className="w-4 h-4" />
          </button>
          {canUpdate && (
            <button
              title="Edit"
              onClick={() => handleEditClick(inv)}
              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
            >
              <HiOutlinePencilSquare className="w-4 h-4" />
            </button>
          )}
          {canUpdate && (
            <button
              title={inv.isActive ? "Nonaktifkan" : "Aktifkan"}
              onClick={() => handleToggleStatus(inv.id, inv.isActive)}
              className={`p-1.5 hover:bg-opacity-20 rounded-lg transition-colors ${
                inv.isActive
                  ? "text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30"
                  : "text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30"
              }`}
            >
              <HiOutlinePower className="w-4 h-4" />
            </button>
          )}
          {canDelete && (
            <button
              title="Hapus Permanen"
              onClick={() => handleDelete(inv.id)}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const renderFormFields = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Username *
        </label>
        <input
          type="text"
          value={form.username}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              username: e.target.value.toLowerCase().replace(/\s/g, ""),
            }))
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="investor1"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Password *
        </label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Nama Lengkap / PIC *
        </label>
        <input
          type="text"
          value={form.namaLengkap}
          onChange={(e) =>
            setForm((f) => ({ ...f, namaLengkap: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Nama lengkap"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Institusi / Perusahaan (Opsional)
        </label>
        <input
          type="text"
          value={form.perusahaan}
          onChange={(e) =>
            setForm((f) => ({ ...f, perusahaan: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="PT Investor Kapital"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Email
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="email@contoh.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          No. Handphone
        </label>
        <input
          type="text"
          value={form.noTelp}
          onChange={(e) => setForm((f) => ({ ...f, noTelp: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="08xxxxxxxxxx"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manajemen Investor
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kelola data investor untuk Rencana Anggaran Biaya
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm"
          >
            <HiOutlinePlus className="w-5 h-5 text-white" />
            <span className="text-white">Tambah Investor</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg">
              <HiOutlineCheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {investors.filter((i) => i.isActive).length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Investor Aktif
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-indigo-50 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-lg">
              <HiOutlineUsers className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {investors.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Investor
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <PageLoader variant="section" message="Memuat data investor..." />
        ) : investors.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <HiOutlineUsers className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              Belum ada investor
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Mulai dengan menambahkan investor baru
            </p>
          </div>
        ) : (
          <ResponsiveTable data={investors} columns={columns} keyField="id" />
        )}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Tambah Investor Baru"
        size="lg"
      >
        {renderFormFields()}
        <ModalFooter>
          <button
            onClick={() => setShowAddModal(false)}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Investor"
        size="lg"
      >
        <div className="mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Peringatan: Kosongkan password jika Anda tidak ingin mengubahnya.
          </p>
        </div>
        {renderFormFields()}
        <ModalFooter>
          <button
            onClick={() => setShowEditModal(false)}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailData(null);
        }}
        title="Detail Investor"
        size="lg"
      >
        <div className="min-h-[300px] p-2">
          {loadingDetail ? (
            <PageLoader
              variant="section"
              message="Memuat informasi lengkap investor..."
            />
          ) : detailData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div>
                  <p className="text-sm text-gray-500">Nama Lengkap</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {detailData.namaLengkap}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Telepon / Email</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {detailData.noTelp || "-"} / {detailData.email || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Perusahaan</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {detailData.perusahaan || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span
                    className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${detailData.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  >
                    {detailData.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-md font-bold text-gray-900 dark:text-white mb-3">
                  Daftar Proyek RAB yang didanai (
                  {detailData.rabProjects?.length || 0})
                </h4>
                {detailData.rabProjects && detailData.rabProjects.length > 0 ? (
                  <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                    {detailData.rabProjects.map((rp) => (
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
                          <span className="text-gray-500">
                            Nilai Investasi:
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            Rp{" "}
                            {Number(rp.investmentAmount).toLocaleString(
                              "id-ID",
                            )}
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
                    onClick={() => setShowPayoutModal(true)}
                    className="text-xs font-semibold bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition"
                  >
                    Catat Payout Baru
                  </button>
                </div>
                {detailData.payouts && detailData.payouts.length > 0 ? (
                  <div className="space-y-3 max-h-[150px] overflow-y-auto custom-scrollbar">
                    {detailData.payouts.map((p) => (
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

      {/* Payout Modal */}
      <Modal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        title="Pencatatan Payout Investor"
        size="md"
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nominal Payout (Rp) *
            </label>
            <input
              type="number"
              value={payoutForm.amount}
              onChange={(e) =>
                setPayoutForm({ ...payoutForm, amount: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tanggal Payout *
            </label>
            <input
              type="date"
              value={payoutForm.date}
              onChange={(e) =>
                setPayoutForm({ ...payoutForm, date: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bank Tujuan Opsional
              </label>
              <input
                type="text"
                value={payoutForm.bankName}
                onChange={(e) =>
                  setPayoutForm({ ...payoutForm, bankName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                placeholder="BCA / Mandiri"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                No Rekening
              </label>
              <input
                type="text"
                value={payoutForm.accountNumber}
                onChange={(e) =>
                  setPayoutForm({
                    ...payoutForm,
                    accountNumber: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Pemilik Rekening *
            </label>
            <input
              type="text"
              value={payoutForm.accountName}
              onChange={(e) =>
                setPayoutForm({ ...payoutForm, accountName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              placeholder="Nama sesuai di buku tabungan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Catatan Tambahan
            </label>
            <textarea
              value={payoutForm.notes}
              onChange={(e) =>
                setPayoutForm({ ...payoutForm, notes: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              rows={2}
            />
          </div>
        </div>
        <ModalFooter>
          <button
            onClick={() => setShowPayoutModal(false)}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Batal
          </button>
          <button
            onClick={handleSavePayout}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            {saving ? "Menyimpan..." : "Simpan Payout"}
          </button>
        </ModalFooter>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        size="sm"
      >
        <div className="py-2">
          <p className="text-gray-600 dark:text-gray-400">
            {confirmModal.message}
          </p>
        </div>
        <ModalFooter>
          <button
            onClick={() =>
              setConfirmModal((prev) => ({ ...prev, isOpen: false }))
            }
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={confirmModal.onConfirm}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${
              confirmModal.variant === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : confirmModal.variant === "warning"
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600"
            }`}
          >
            Konfirmasi
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
