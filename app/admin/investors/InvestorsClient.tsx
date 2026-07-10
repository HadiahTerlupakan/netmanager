"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import PageLoader from "@/components/ui/PageLoader";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";
import { useApi } from "@/lib/hooks/useApi";
import { formatForDateInput } from "@/lib/utils/datetime";
import {
  HiOutlinePlus,
  HiOutlineUsers,
  HiOutlineCheckCircle,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlinePower,
  HiOutlineEye,
} from "react-icons/hi2";
import type { InvestorListItem, InvestorDetail } from "@/modules/investor/dto";
import {
  InvestorFormModal,
  type InvestorFormValues,
} from "./_components/InvestorFormModal";
import { InvestorDetailModal } from "./_components/InvestorDetailModal";
import { PayoutModal, type PayoutFormValues } from "./_components/PayoutModal";
import { ConfirmModal } from "./_components/ConfirmModal";

const EMPTY_INVESTOR_FORM: InvestorFormValues = {
  username: "",
  password: "",
  namaLengkap: "",
  email: "",
  noTelp: "",
  perusahaan: "",
};

const buildEmptyPayoutForm = (): PayoutFormValues => ({
  amount: "",
  date: formatForDateInput(new Date()),
  bankName: "",
  accountNumber: "",
  accountName: "",
  reference: "",
  notes: "",
});

type ConfirmState = {
  isOpen: boolean;
  title: string;
  message: string;
  variant: "danger" | "warning" | "primary";
  onConfirm: () => void;
};

const EMPTY_CONFIRM: ConfirmState = {
  isOpen: false,
  title: "",
  message: "",
  variant: "primary",
  onConfirm: () => {},
};

export default function InvestorsClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("investors:create");
  const canUpdate = hasPermission("investors:update");
  const canDelete = hasPermission("investors:delete");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<InvestorDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(EMPTY_CONFIRM);

  const [form, setForm] = useState<InvestorFormValues>(EMPTY_INVESTOR_FORM);
  const [payoutForm, setPayoutForm] = useState<PayoutFormValues>(
    buildEmptyPayoutForm(),
  );

  const {
    data: investorsData,
    isLoading: loading,
    mutate: refetchInvestors,
  } = useApi<InvestorListItem[]>("/api/admin/investors", {
    onError: () => toast.error("Terjadi kesalahan saat memuat data investor"),
  });
  const investors = investorsData ?? [];

  const closeConfirm = () =>
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));

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
        setForm(EMPTY_INVESTOR_FORM);
        void refetchInvestors();
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
        setPayoutForm(buildEmptyPayoutForm());
        if (detailData) void handleViewDetail(detailData.id);
      } else {
        toast.error(data.message || "Gagal mencatat payout");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (inv: InvestorListItem) => {
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
        setForm(EMPTY_INVESTOR_FORM);
        void refetchInvestors();
      } else {
        toast.error(data.message || "Gagal memperbarui investor");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = (id: string, currentStatus: boolean) => {
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
            void refetchInvestors();
          } else {
            const data = await res.json();
            toast.error(data.message || "Gagal mengubah status");
          }
        } catch {
          toast.error("Terjadi kesalahan");
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const handleDelete = (id: string) => {
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
            void refetchInvestors();
          } else {
            const data = await res.json();
            toast.error(data.message || "Gagal menghapus investor");
          }
        } catch {
          toast.error("Terjadi kesalahan");
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const columns: Column<InvestorListItem>[] = [
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
              setForm(EMPTY_INVESTOR_FORM);
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

      <InvestorFormModal
        isOpen={showAddModal}
        saving={saving}
        form={form}
        onChange={setForm}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAdd}
      />

      <InvestorFormModal
        isOpen={showEditModal}
        isEdit
        saving={saving}
        form={form}
        onChange={setForm}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleSaveEdit}
      />

      <InvestorDetailModal
        isOpen={showDetailModal}
        loading={loadingDetail}
        data={detailData}
        onClose={() => {
          setShowDetailModal(false);
          setDetailData(null);
        }}
        onCreatePayout={() => setShowPayoutModal(true)}
      />

      <PayoutModal
        isOpen={showPayoutModal}
        saving={saving}
        form={payoutForm}
        onChange={setPayoutForm}
        onClose={() => setShowPayoutModal(false)}
        onSubmit={handleSavePayout}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
}
