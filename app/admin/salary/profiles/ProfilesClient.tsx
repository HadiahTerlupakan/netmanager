"use client";

import { useState, useCallback } from "react";
import { useApi } from "@/lib/hooks/useApi";
import {
  HiOutlinePencilSquare,
  HiOutlineArrowLeft,
  HiOutlineUserGroup,
  HiOutlinePlusCircle,
  HiOutlineTrash,
  HiOutlineClock,
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
  userId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeType: "PKWTT" | "PKWT" | "DAILY" | "FREELANCE";
  taxMethod: "NET" | "GROSS_UP" | "NETT";
  ptkpStatus: string;
  basicSalary: number;
  bankName: string | null;
  bankAccount: string | null;
  npwp: string | null;
  bpjsKesehatan: boolean;
  bpjsJht: boolean;
  bpjsJp: boolean;
  bpjsJkk: boolean;
  bpjsJkm: boolean;
  scheduleType: "MONTHLY" | "BI_WEEKLY" | "WEEKLY" | "DAILY" | "ON_DEMAND";
  scheduleName: string;
  regionCode: string;
  contractStart: string | null;
  contractEnd: string | null;
  overtimeEligible: boolean;
  thrEligible: boolean;
  isActive: boolean;
  payPeriodDay: number;
  payDay: number;
  woIncentiveEnabled: boolean;
  woIncentiveRate: number;
  lateDeductionRate: number;
  absentDeductionRate: number;
  overtimeRateNormal: number;
  overtimeRateHoliday: number;
  overtimeRateNational: number;
  overtimeCalcTypeNormal: string;
  overtimeCalcTypeHoliday: string;
  overtimeCalcTypeNational: string;
}

interface ProfilesResponse {
  profiles: EmployeeProfile[];
}

interface ProfileFormData {
  employeeType: "PKWTT" | "PKWT" | "DAILY" | "FREELANCE";
  taxMethod: "NET" | "GROSS_UP" | "NETT";
  ptkpStatus: string;
  basicSalary: number;
  bankName: string;
  bankAccount: string;
  npwp: string;
  bpjsKesehatan: boolean;
  bpjsJht: boolean;
  bpjsJp: boolean;
  bpjsJkk: boolean;
  bpjsJkm: boolean;
  scheduleType: "MONTHLY" | "BI_WEEKLY" | "WEEKLY" | "DAILY" | "ON_DEMAND";
  isActive: boolean;
  payPeriodDay: number;
  payDay: number;
  woIncentiveEnabled: boolean;
  woIncentiveRate: number;
  lateDeductionRate: number;
  absentDeductionRate: number;
  overtimeRateNormal: number;
  overtimeRateHoliday: number;
  overtimeRateNational: number;
  overtimeCalcTypeNormal: string;
  overtimeCalcTypeHoliday: string;
  overtimeCalcTypeNational: string;
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
};

const SCHEDULE_LABELS: Record<string, string> = {
  MONTHLY: "Bulanan",
  BI_WEEKLY: "Dua Mingguan",
  WEEKLY: "Mingguan",
  DAILY: "Harian",
  ON_DEMAND: "Sesuai Kebutuhan",
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

const OVERTIME_CALC_TYPE_OPTIONS = [
  { value: "PER_HOUR", label: "Per Jam" },
  { value: "DAILY_SALARY", label: "Gaji Harian" },
  { value: "FIXED", label: "Tetap (Rp)" },
  { value: "PERCENTAGE", label: "% Gaji Pokok" },
];

const OVERTIME_CONFIGS = [
  {
    key: "Normal",
    label: "Hari Kerja",
    color: "indigo" as const,
    calcTypeKey: "overtimeCalcTypeNormal" as const,
    rateKey: "overtimeRateNormal" as const,
  },
  {
    key: "Holiday",
    label: "Hari Libur",
    color: "amber" as const,
    calcTypeKey: "overtimeCalcTypeHoliday" as const,
    rateKey: "overtimeRateHoliday" as const,
  },
  {
    key: "National",
    label: "Libur Nas.",
    color: "rose" as const,
    calcTypeKey: "overtimeCalcTypeNational" as const,
    rateKey: "overtimeRateNational" as const,
  },
];

const OVERTIME_COLOR_CLASSES: Record<
  "indigo" | "amber" | "rose",
  { border: string; text: string; textDark: string }
> = {
  indigo: {
    border: "border-indigo-100 dark:border-indigo-900/20",
    text: "text-indigo-700",
    textDark: "dark:text-indigo-400",
  },
  amber: {
    border: "border-amber-100 dark:border-amber-900/20",
    text: "text-amber-700",
    textDark: "dark:text-amber-400",
  },
  rose: {
    border: "border-rose-100 dark:border-rose-900/20",
    text: "text-rose-700",
    textDark: "dark:text-rose-400",
  },
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
    ptkpStatus: "TK/0",
    basicSalary: 0,
    bankName: "",
    bankAccount: "",
    npwp: "",
    bpjsKesehatan: false,
    bpjsJht: false,
    bpjsJp: false,
    bpjsJkk: false,
    bpjsJkm: false,
    scheduleType: "MONTHLY",
    isActive: true,
    payPeriodDay: 1,
    payDay: 25,
    woIncentiveEnabled: false,
    woIncentiveRate: 0,
    lateDeductionRate: 0,
    absentDeductionRate: 0,
    overtimeRateNormal: 0,
    overtimeRateHoliday: 0,
    overtimeRateNational: 0,
    overtimeCalcTypeNormal: "FIXED",
    overtimeCalcTypeHoliday: "FIXED",
    overtimeCalcTypeNational: "FIXED",
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
    fetchEmployeeComponents(profile.userId);
    fetchAvailableComponents();
    setForm({
      employeeType: profile.employeeType,
      taxMethod: profile.taxMethod,
      ptkpStatus: profile.ptkpStatus || "TK/0",
      basicSalary: profile.basicSalary,
      bankName: profile.bankName || "",
      bankAccount: profile.bankAccount || "",
      npwp: profile.npwp || "",
      bpjsKesehatan: !!profile.bpjsKesehatan,
      bpjsJht: !!profile.bpjsJht,
      bpjsJp: !!profile.bpjsJp,
      bpjsJkk: !!profile.bpjsJkk,
      bpjsJkm: !!profile.bpjsJkm,
      scheduleType: profile.scheduleType,
      isActive: profile.isActive,
      payPeriodDay: profile.payPeriodDay ?? 1,
      payDay: profile.payDay ?? 25,
      woIncentiveEnabled: profile.woIncentiveEnabled ?? false,
      woIncentiveRate: profile.woIncentiveRate ?? 0,
      lateDeductionRate: profile.lateDeductionRate ?? 0,
      absentDeductionRate: profile.absentDeductionRate ?? 0,
      overtimeRateNormal: profile.overtimeRateNormal ?? 0,
      overtimeRateHoliday: profile.overtimeRateHoliday ?? 0,
      overtimeRateNational: profile.overtimeRateNational ?? 0,
      overtimeCalcTypeNormal: profile.overtimeCalcTypeNormal ?? "FIXED",
      overtimeCalcTypeHoliday: profile.overtimeCalcTypeHoliday ?? "FIXED",
      overtimeCalcTypeNational: profile.overtimeCalcTypeNational ?? "FIXED",
    });
    setModalOpen(true);
  };

  /** Save profile */
  const handleSave = async () => {
    if (!editingProfile) return;
    setSaving(true);
    try {
      const { bpjsKesehatan, bpjsJht, bpjsJp, bpjsJkk, bpjsJkm, ...rest } =
        form;
      const payload = {
        ...rest,
        bpjsConfig: {
          kesehatan: bpjsKesehatan,
          jht: bpjsJht,
          jp: bpjsJp,
          jkk: bpjsJkk,
          jkm: bpjsJkm,
        },
      };
      const res = await fetch(
        `/api/admin/salary/profiles/${editingProfile.userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
        `/api/admin/salary/profiles/${editingProfile.userId}/components`,
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
        `/api/admin/salary/profiles/${editingProfile.userId}/components`,
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
          {TAX_METHOD_LABELS[item.taxMethod]} ({item.ptkpStatus})
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
            <div className="space-y-6">
              {/* Section 1: Informasi Dasar */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold tracking-wide">
                  Informasi Dasar
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <option value="PKWTT">Tetap</option>
                      <option value="PKWT">Kontrak</option>
                      <option value="DAILY">Harian</option>
                      <option value="FREELANCE">Freelance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Gaji Pokok
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                        Rp
                      </span>
                      <input
                        type="number"
                        value={form.basicSalary}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            basicSalary: Number(e.target.value),
                          })
                        }
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                      />
                    </div>
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
                      <option value="BI_WEEKLY">Dua Mingguan</option>
                      <option value="WEEKLY">Mingguan</option>
                      <option value="DAILY">Harian</option>
                      <option value="ON_DEMAND">Sesuai Kebutuhan</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Periode & Pembayaran */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold tracking-wide">
                  Periode & Pembayaran
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Tgl Mulai Periode
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={form.payPeriodDay}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          payPeriodDay: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Tgl Gajian
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={form.payDay}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          payDay: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Insentif & Potongan */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold tracking-wide">
                  Insentif & Potongan
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Insentif WO
                      </span>
                      <p className="text-xs text-gray-500">
                        Aktifkan bonus per WO selesai
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {form.woIncentiveEnabled && (
                        <input
                          type="number"
                          value={form.woIncentiveRate}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              woIncentiveRate: Number(e.target.value),
                            })
                          }
                          placeholder="Rp/WO"
                          className="w-24 px-2 py-1 text-xs border border-emerald-200 dark:border-emerald-800 rounded bg-emerald-50/50 dark:bg-emerald-900/20 text-gray-900 dark:text-white"
                        />
                      )}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.woIncentiveEnabled}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              woIncentiveEnabled: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-rose-100 dark:border-rose-900/20">
                      <span className="text-xs font-medium text-rose-700 dark:text-rose-400 block mb-1">
                        Denda Terlambat
                      </span>
                      <input
                        type="number"
                        value={form.lateDeductionRate}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            lateDeductionRate: Number(e.target.value),
                          })
                        }
                        placeholder="Rp/Menit"
                        className="w-full px-2 py-1 text-xs border border-rose-100 dark:border-rose-900/30 rounded bg-rose-50/30 dark:bg-rose-900/10 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-rose-100 dark:border-rose-900/20">
                      <span className="text-xs font-medium text-rose-700 dark:text-rose-400 block mb-1">
                        Denda Mangkir
                      </span>
                      <input
                        type="number"
                        value={form.absentDeductionRate}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            absentDeductionRate: Number(e.target.value),
                          })
                        }
                        placeholder="Rp/Hari"
                        className="w-full px-2 py-1 text-xs border border-rose-100 dark:border-rose-900/30 rounded bg-rose-50/30 dark:bg-rose-900/10 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Konfigurasi Lembur */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold tracking-wide flex items-center gap-2">
                  <HiOutlineClock className="w-3.5 h-3.5" />
                  Konfigurasi Lembur
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {OVERTIME_CONFIGS.map((item) => {
                    const colorCls = OVERTIME_COLOR_CLASSES[item.color];
                    return (
                      <div
                        key={item.key}
                        className={`p-3 bg-white dark:bg-gray-800 rounded-lg border ${colorCls.border}`}
                      >
                        <span
                          className={`text-xs font-bold ${colorCls.text} ${colorCls.textDark} block mb-2`}
                        >
                          {item.label}
                        </span>
                        <div className="space-y-2">
                          <select
                            value={form[item.calcTypeKey]}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                [item.calcTypeKey]: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900/30 text-gray-900 dark:text-white"
                          >
                            {OVERTIME_CALC_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <div className="relative">
                            <input
                              type="number"
                              value={form[item.rateKey]}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  [item.rateKey]: Number(e.target.value),
                                })
                              }
                              className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                            />
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                              Rp
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 5: Perpajakan */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold tracking-wide">
                  Perpajakan
                </h4>
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
                      <option value="NET">Net (Karyawan tanggung)</option>
                      <option value="GROSS_UP">
                        Gross Up (Perusahaan tanggung)
                      </option>
                      <option value="NETT">
                        Nett (Perusahaan tanggung, tidak masuk penghasilan)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Status PTKP
                    </label>
                    <select
                      value={form.ptkpStatus}
                      onChange={(e) =>
                        setForm({ ...form, ptkpStatus: e.target.value })
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
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      NPWP
                    </label>
                    <input
                      type="text"
                      value={form.npwp}
                      onChange={(e) =>
                        setForm({ ...form, npwp: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                      placeholder="00.000.000.0-000.000"
                    />
                  </div>
                </div>
              </div>

              {/* Section 6: BPJS */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold tracking-wide">
                  BPJS
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.bpjsKesehatan}
                      onChange={(e) =>
                        setForm({ ...form, bpjsKesehatan: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Kesehatan
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.bpjsJht}
                      onChange={(e) =>
                        setForm({ ...form, bpjsJht: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      JHT
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.bpjsJp}
                      onChange={(e) =>
                        setForm({ ...form, bpjsJp: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      JP
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.bpjsJkk}
                      onChange={(e) =>
                        setForm({ ...form, bpjsJkk: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      JKK
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.bpjsJkm}
                      onChange={(e) =>
                        setForm({ ...form, bpjsJkm: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      JKM
                    </span>
                  </label>
                </div>
              </div>

              {/* Section 7: Informasi Bank */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold tracking-wide">
                  Informasi Bank
                </h4>
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
              </div>

              {/* Section 8: Status */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold tracking-wide">
                  Status
                </h4>
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
