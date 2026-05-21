"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import {
  HiOutlinePencilSquare,
  HiOutlineArrowLeft,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/Modal";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import Link from "next/link";

// ============================================================================
// Types
// ============================================================================

interface EmployeeProfile {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeType: "TETAP" | "KONTRAK" | "HARIAN";
  taxMethod: "GROSS" | "GROSS_UP" | "NET";
  taxStatus: string;
  basicSalary: number;
  bankName: string | null;
  bankAccount: string | null;
  npwp: string | null;
  bpjsKesehatan: string | null;
  bpjsKetenagakerjaan: string | null;
  scheduleType: "MONTHLY" | "WEEKLY" | "DAILY";
  isActive: boolean;
}

interface ProfilesResponse {
  profiles: EmployeeProfile[];
}

interface ProfileFormData {
  employeeType: "TETAP" | "KONTRAK" | "HARIAN";
  taxMethod: "GROSS" | "GROSS_UP" | "NET";
  taxStatus: string;
  basicSalary: number;
  bankName: string;
  bankAccount: string;
  npwp: string;
  bpjsKesehatan: string;
  bpjsKetenagakerjaan: string;
  scheduleType: "MONTHLY" | "WEEKLY" | "DAILY";
  isActive: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_LABELS: Record<string, string> = {
  TETAP: "Tetap",
  KONTRAK: "Kontrak",
  HARIAN: "Harian",
};

const TYPE_COLORS: Record<string, string> = {
  TETAP: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  KONTRAK:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  HARIAN: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const TAX_METHOD_LABELS: Record<string, string> = {
  GROSS: "Gross",
  GROSS_UP: "Gross Up",
  NET: "Nett",
};

const SCHEDULE_LABELS: Record<string, string> = {
  MONTHLY: "Bulanan",
  WEEKLY: "Mingguan",
  DAILY: "Harian",
};

// ============================================================================
// Component
// ============================================================================

export default function ProfilesClient() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<EmployeeProfile | null>(
    null,
  );
  const [form, setForm] = useState<ProfileFormData>({
    employeeType: "TETAP",
    taxMethod: "GROSS",
    taxStatus: "TK/0",
    basicSalary: 0,
    bankName: "",
    bankAccount: "",
    npwp: "",
    bpjsKesehatan: "",
    bpjsKetenagakerjaan: "",
    scheduleType: "MONTHLY",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const {
    data: response,
    isLoading: loading,
    mutate: refetch,
  } = useApi<ProfilesResponse>("/api/admin/salary/profiles");

  const profiles = response?.profiles ?? [];

  /** Open edit modal */
  const handleEdit = (profile: EmployeeProfile) => {
    setEditingProfile(profile);
    setForm({
      employeeType: profile.employeeType,
      taxMethod: profile.taxMethod,
      taxStatus: profile.taxStatus,
      basicSalary: profile.basicSalary,
      bankName: profile.bankName || "",
      bankAccount: profile.bankAccount || "",
      npwp: profile.npwp || "",
      bpjsKesehatan: profile.bpjsKesehatan || "",
      bpjsKetenagakerjaan: profile.bpjsKetenagakerjaan || "",
      scheduleType: profile.scheduleType,
      isActive: profile.isActive,
    });
    setModalOpen(true);
  };

  /** Save profile */
  const handleSave = async () => {
    if (!editingProfile) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/salary/profiles/${editingProfile.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        refetch();
      } else {
        alert(data.error || "Gagal menyimpan profil");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  // Table columns
  const columns: Column<EmployeeProfile>[] = [
    {
      key: "employeeName",
      header: "Karyawan",
      priority: "primary",
      minWidth: "200px",
      render: (item) => (
        <div className="py-1">
          <div className="font-semibold text-gray-900 dark:text-white">
            {item.employeeName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {item.employeeEmail}
          </div>
        </div>
      ),
    },
    {
      key: "employeeType",
      header: "Tipe",
      priority: "primary",
      align: "center",
      render: (item) => (
        <Badge
          className={`${TYPE_COLORS[item.employeeType]} border-none shadow-none text-[10px] font-bold px-2 py-0.5 rounded-full`}
        >
          {TYPE_LABELS[item.employeeType]}
        </Badge>
      ),
    },
    {
      key: "taxMethod",
      header: "Metode Pajak",
      priority: "secondary",
      render: (item) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {TAX_METHOD_LABELS[item.taxMethod]} ({item.taxStatus})
        </span>
      ),
    },
    {
      key: "basicSalary",
      header: "Gaji Pokok",
      priority: "primary",
      align: "right",
      minWidth: "140px",
      render: (item) => (
        <span className="font-bold text-gray-900 dark:text-white">
          {formatCurrency(item.basicSalary)}
        </span>
      ),
    },
    {
      key: "scheduleType",
      header: "Jadwal",
      priority: "secondary",
      render: (item) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {SCHEDULE_LABELS[item.scheduleType]}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      priority: "primary",
      align: "center",
      render: (item) => (
        <span
          className={`px-2 py-1 rounded-full text-[10px] font-bold ${
            item.isActive
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {item.isActive ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
  ];

  const renderActions = (item: EmployeeProfile) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleEdit(item);
      }}
      className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full text-gray-500 hover:text-indigo-600 transition-all active:scale-95"
      title="Edit Profil"
    >
      <HiOutlinePencilSquare className="w-5 h-5" />
    </button>
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/salary">
            <Button variant="ghost" className="p-2">
              <HiOutlineArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              Profil Payroll Karyawan
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Konfigurasi data payroll per karyawan
            </p>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            data={profiles}
            columns={columns}
            keyField="id"
            loading={loading}
            emptyMessage={
              <div className="text-center py-12">
                <HiOutlineUserGroup className="w-16 h-16 mx-auto mb-4 text-gray-200 dark:text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Belum Ada Profil
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Profil payroll akan otomatis dibuat saat karyawan ditambahkan.
                </p>
              </div>
            }
            renderActions={renderActions}
            onRowClick={(item) => handleEdit(item)}
            className="border-none"
          />
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingProfile
            ? `Edit Profil - ${editingProfile.employeeName}`
            : "Edit Profil"
        }
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Tipe Karyawan
              </label>
              <select
                value={form.employeeType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    employeeType: e.target
                      .value as ProfileFormData["employeeType"],
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
              >
                <option value="TETAP">Tetap</option>
                <option value="KONTRAK">Kontrak</option>
                <option value="HARIAN">Harian</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Gaji Pokok
              </label>
              <input
                type="number"
                value={form.basicSalary}
                onChange={(e) =>
                  setForm({ ...form, basicSalary: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Metode Pajak
              </label>
              <select
                value={form.taxMethod}
                onChange={(e) =>
                  setForm({
                    ...form,
                    taxMethod: e.target.value as ProfileFormData["taxMethod"],
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
              >
                <option value="GROSS">Gross</option>
                <option value="GROSS_UP">Gross Up</option>
                <option value="NET">Nett</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Status Pajak (PTKP)
              </label>
              <select
                value={form.taxStatus}
                onChange={(e) =>
                  setForm({ ...form, taxStatus: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
              >
                <option value="TK/0">TK/0</option>
                <option value="TK/1">TK/1</option>
                <option value="TK/2">TK/2</option>
                <option value="TK/3">TK/3</option>
                <option value="K/0">K/0</option>
                <option value="K/1">K/1</option>
                <option value="K/2">K/2</option>
                <option value="K/3">K/3</option>
                <option value="K/I/0">K/I/0</option>
                <option value="K/I/1">K/I/1</option>
                <option value="K/I/2">K/I/2</option>
                <option value="K/I/3">K/I/3</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Jadwal Gaji
              </label>
              <select
                value={form.scheduleType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    scheduleType: e.target
                      .value as ProfileFormData["scheduleType"],
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
              >
                <option value="MONTHLY">Bulanan</option>
                <option value="WEEKLY">Mingguan</option>
                <option value="DAILY">Harian</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Nama Bank
              </label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                placeholder="BCA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                No. Rekening
              </label>
              <input
                type="text"
                value={form.bankAccount}
                onChange={(e) =>
                  setForm({ ...form, bankAccount: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                placeholder="1234567890"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                NPWP
              </label>
              <input
                type="text"
                value={form.npwp}
                onChange={(e) => setForm({ ...form, npwp: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                placeholder="00.000.000.0-000.000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                BPJS Kesehatan
              </label>
              <input
                type="text"
                value={form.bpjsKesehatan}
                onChange={(e) =>
                  setForm({ ...form, bpjsKesehatan: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                placeholder="0001234567890"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                BPJS Ketenagakerjaan
              </label>
              <input
                type="text"
                value={form.bpjsKetenagakerjaan}
                onChange={(e) =>
                  setForm({ ...form, bpjsKetenagakerjaan: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                placeholder="0001234567890"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Profil Aktif
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
