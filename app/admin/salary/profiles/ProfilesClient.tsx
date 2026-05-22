"use client";

import { useState, useCallback } from "react";
import { useApi } from "@/lib/hooks/useApi";
import {
  HiOutlinePencilSquare,
  HiOutlineArrowLeft,
  HiOutlineUserGroup,
  HiOutlinePlusCircle,
  HiOutlineTrash,
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
  employeeType: "PKWTT" | "PKWT" | "DAILY" | "FREELANCE";
  taxMethod: "NET" | "GROSS_UP" | "NETT";
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
  employeeType: "PKWTT" | "PKWT" | "DAILY" | "FREELANCE";
  taxMethod: "NET" | "GROSS_UP" | "NETT";
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

interface EmployeeComponent {
  componentId: string;
  componentCode: string;
  componentName: string;
  category: "EARNING" | "DEDUCTION" | "EMPLOYER_COST" | "TAX";
  calculationType: string;
  amount: number | null;
  isActive: boolean;
}

interface PayrollComponent {
  id: string;
  name: string;
  code: string;
  category: "EARNING" | "DEDUCTION" | "EMPLOYER_COST" | "TAX";
  calculationType: string;
  defaultAmount: number | null;
  isActive: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_LABELS: Record<string, string> = {
  PKWTT: "Tetap",
  PKWT: "Kontrak",
  DAILY: "Harian",
  FREELANCE: "Freelance",
};

const TYPE_COLORS: Record<string, string> = {
  PKWTT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  PKWT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  DAILY: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  FREELANCE:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

const TAX_METHOD_LABELS: Record<string, string> = {
  NET: "Net",
  GROSS_UP: "Gross Up",
  NETT: "Nett",
  NET: "Nett",
};

const SCHEDULE_LABELS: Record<string, string> = {
  MONTHLY: "Bulanan",
  WEEKLY: "Mingguan",
  DAILY: "Harian",
};

const CATEGORY_LABELS: Record<string, string> = {
  EARNING: "Tunjangan",
  DEDUCTION: "Potongan",
  EMPLOYER_COST: "Biaya Perusahaan",
  TAX: "Pajak",
};

const CATEGORY_COLORS: Record<string, string> = {
  EARNING:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DEDUCTION: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  EMPLOYER_COST:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  TAX: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

const CALC_TYPE_LABELS: Record<string, string> = {
  FIXED: "Nominal Tetap",
  PERCENTAGE: "Persentase",
  FORMULA: "Formula",
  PER_HOUR: "Per Jam",
  PER_DAY: "Per Hari",
  PER_UNIT: "Per Unit",
};

// ============================================================================
// Component
// ============================================================================

export default function ProfilesClient() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<EmployeeProfile | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"profil" | "komponen">("profil");
  const [form, setForm] = useState<ProfileFormData>({
    employeeType: "PKWTT",
    taxMethod: "NET",
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

  // Component assignment state
  const [employeeComponents, setEmployeeComponents] = useState<
    EmployeeComponent[]
  >([]);
  const [availableComponents, setAvailableComponents] = useState<
    PayrollComponent[]
  >([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [addComponentOpen, setAddComponentOpen] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState("");
  const [componentAmount, setComponentAmount] = useState<number | null>(null);
  const [savingComponent, setSavingComponent] = useState(false);

  const {
    data: response,
    isLoading: loading,
    mutate: refetch,
  } = useApi<ProfilesResponse>("/api/admin/salary/profiles");

  const profiles = response?.profiles ?? [];

  /** Fetch employee components */
  const fetchEmployeeComponents = useCallback(async (userId: string) => {
    setLoadingComponents(true);
    try {
      const res = await fetch(
        `/api/admin/salary/profiles/${userId}/components`,
      );
      const data = await res.json();
      if (data.success) {
        setEmployeeComponents(data.data.components ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingComponents(false);
    }
  }, []);

  /** Fetch available components for assignment */
  const fetchAvailableComponents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/salary/components?isActive=true");
      const data = await res.json();
      if (data.success) {
        setAvailableComponents(data.data.components ?? []);
      }
    } catch {
      // silent
    }
  }, []);

  /** Open edit modal */
  const handleEdit = (profile: EmployeeProfile) => {
    setEditingProfile(profile);
    setActiveTab("profil");
    fetchEmployeeComponents(profile.id);
    fetchAvailableComponents();
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

  /** Assign component to employee */
  const handleAssignComponent = async () => {
    if (!editingProfile || !selectedComponentId) return;
    setSavingComponent(true);
    try {
      const res = await fetch(
        `/api/admin/salary/profiles/${editingProfile.id}/components`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            componentId: selectedComponentId,
            amount: componentAmount,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setEmployeeComponents(data.data.components ?? []);
        setAddComponentOpen(false);
        setSelectedComponentId("");
        setComponentAmount(null);
      } else {
        alert(data.error || "Gagal menambahkan komponen");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setSavingComponent(false);
    }
  };

  /** Remove component from employee */
  const handleRemoveComponent = async (componentId: string) => {
    if (!editingProfile) return;
    if (!confirm("Hapus komponen ini dari karyawan?")) return;
    try {
      const res = await fetch(
        `/api/admin/salary/profiles/${editingProfile.id}/components`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ componentId }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setEmployeeComponents(data.data.components ?? []);
      } else {
        alert(data.error || "Gagal menghapus komponen");
      }
    } catch {
      alert("Terjadi kesalahan");
    }
  };

  /** Get components not yet assigned to this employee */
  const unassignedComponents = availableComponents.filter(
    (c) => !employeeComponents.some((ec) => ec.componentId === c.id),
  );

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
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("profil")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "profil"
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Data Profil
            </button>
            <button
              onClick={() => setActiveTab("komponen")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "komponen"
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Komponen Gaji
              {employeeComponents.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  {employeeComponents.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab: Profil */}
          {activeTab === "profil" && (
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
                        taxMethod: e.target
                          .value as ProfileFormData["taxMethod"],
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
                    onChange={(e) =>
                      setForm({ ...form, bankName: e.target.value })
                    }
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
          )}

          {/* Tab: Komponen Gaji */}
          {activeTab === "komponen" && (
            <div className="space-y-4">
              {/* Add component button */}
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Komponen tunjangan dan potongan yang berlaku untuk karyawan
                  ini.
                </p>
                <Button
                  onClick={() => setAddComponentOpen(true)}
                  disabled={unassignedComponents.length === 0}
                  className="flex items-center gap-1.5"
                >
                  <HiOutlinePlusCircle className="w-4 h-4" />
                  Tambah Komponen
                </Button>
              </div>

              {/* Component list */}
              {loadingComponents ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Memuat komponen...
                </div>
              ) : employeeComponents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    Belum ada komponen yang ditambahkan.
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400">
                          Komponen
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400">
                          Kategori
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400">
                          Tipe Kalkulasi
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium text-gray-600 dark:text-gray-400">
                          Nominal
                        </th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-600 dark:text-gray-400">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {employeeComponents.map((comp) => (
                        <tr
                          key={comp.componentId}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {comp.componentName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {comp.componentCode}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge
                              className={`${CATEGORY_COLORS[comp.category] || ""} border-none shadow-none text-[10px] font-bold px-2 py-0.5 rounded-full`}
                            >
                              {CATEGORY_LABELS[comp.category] || comp.category}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                            {CALC_TYPE_LABELS[comp.calculationType] ||
                              comp.calculationType}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">
                            {comp.amount != null
                              ? formatCurrency(comp.amount)
                              : "-"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() =>
                                handleRemoveComponent(comp.componentId)
                              }
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-gray-400 hover:text-red-600 transition-colors"
                              title="Hapus komponen"
                            >
                              <HiOutlineTrash className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add component inline form */}
              {addComponentOpen && (
                <div className="border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 bg-indigo-50/50 dark:bg-indigo-900/10 space-y-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Tambah Komponen Baru
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                        Pilih Komponen
                      </label>
                      <select
                        value={selectedComponentId}
                        onChange={(e) => {
                          setSelectedComponentId(e.target.value);
                          const comp = availableComponents.find(
                            (c) => c.id === e.target.value,
                          );
                          if (comp?.defaultAmount) {
                            setComponentAmount(comp.defaultAmount);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                      >
                        <option value="">-- Pilih komponen --</option>
                        {unassignedComponents.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (
                            {CATEGORY_LABELS[c.category] || c.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                        Nominal (opsional)
                      </label>
                      <input
                        type="number"
                        value={componentAmount ?? ""}
                        onChange={(e) =>
                          setComponentAmount(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAddComponentOpen(false);
                        setSelectedComponentId("");
                        setComponentAmount(null);
                      }}
                    >
                      Batal
                    </Button>
                    <Button
                      onClick={handleAssignComponent}
                      disabled={!selectedComponentId || savingComponent}
                    >
                      {savingComponent ? "Menyimpan..." : "Tambahkan"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
