"use client";

import { useState } from "react";
import {
  Check,
  RefreshCw,
  Shield,
  Calculator,
  Clock,
  Gift,
  Wallet,
  Lock,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";

type PayrollConfig = {
  bpjs: {
    kesehatan: {
      employeeRate: number;
      employerRate: number;
      maxBase: number | null;
    };
    jht: { employeeRate: number; employerRate: number; maxBase: number | null };
    jp: {
      employeeRate: number;
      employerRate: number;
      maxBase: number | null;
      maxAge: number;
    };
    jkk: { employerRate: number; riskCategory?: number };
    jkm: { employerRate: number };
  };
  tax: {
    defaultMethod: string;
    npwpSurcharge: number;
    biayaJabatanRate: number;
    biayaJabatanMax: number;
    biayaJabatanMaxAnnual: number;
    annualCorrectionMonth: number;
  };
  overtime: {
    maxHoursPerDay: number;
    maxHoursPerWeek: number;
    maxHoursPerMonth: number | null;
    rateBase: string;
    capEnforcement: string;
  };
  thrConfig: {
    eligibleAfterMonths: number;
    fullEntitlementMonths: number;
    prorata: boolean;
    paymentDeadlineDays: number;
  };
  advancePolicy: {
    maxPercentOfSalary: number;
    maxActiveAdvances: number;
    minDaysBetweenRequests: number;
    approvalRequired: boolean;
    deductionMethod: string;
    maxInstallments: number;
  };
  periodLocking: {
    autoLockAfterPaid: boolean;
    autoLockDelayDays: number;
    requireApprovalToUnlock: boolean;
    maxUnlockCount: number;
  };
};

type TabKey = "bpjs" | "tax" | "overtime" | "thr" | "advance" | "locking";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "bpjs", label: "BPJS", icon: <Shield className="w-4 h-4 mr-2" /> },
  { key: "tax", label: "Pajak", icon: <Calculator className="w-4 h-4 mr-2" /> },
  {
    key: "overtime",
    label: "Lembur",
    icon: <Clock className="w-4 h-4 mr-2" />,
  },
  { key: "thr", label: "THR", icon: <Gift className="w-4 h-4 mr-2" /> },
  {
    key: "advance",
    label: "Kasbon",
    icon: <Wallet className="w-4 h-4 mr-2" />,
  },
  {
    key: "locking",
    label: "Period Lock",
    icon: <Lock className="w-4 h-4 mr-2" />,
  },
];

export function PayrollConfigClient() {
  const { showToast } = useToast();
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("salary:manage");
  const [activeTab, setActiveTab] = useState<TabKey>("bpjs");
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PayrollConfig | null>(null);

  const { isLoading } = useApi<PayrollConfig>("/api/admin/salary/config", {
    onSuccess: (result) => {
      if (result) setConfig(result);
    },
  });

  const handleSave = async () => {
    if (!canUpdate || !config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/salary/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const result = await res.json();
      if (result.success) {
        showToast("success", "Konfigurasi payroll berhasil disimpan");
      } else {
        showToast("error", result.error || "Gagal menyimpan konfigurasi");
      }
    } catch {
      showToast("error", "Terjadi kesalahan sistem");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !config) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pt-4">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 flex items-center shadow-sm overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={
              "flex-1 py-2 flex justify-center items-center text-[13px] font-semibold rounded-md transition-colors whitespace-nowrap px-3 " +
              (activeTab === tab.key
                ? "bg-[#3b5fe5] text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700")
            }
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "bpjs" && (
          <BpjsTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "tax" && (
          <TaxTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "overtime" && (
          <OvertimeTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "thr" && (
          <ThrTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "advance" && (
          <AdvanceTab config={config} setConfig={setConfig} />
        )}
        {activeTab === "locking" && (
          <LockingTab config={config} setConfig={setConfig} />
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          onClick={handleSave}
          disabled={saving || !canUpdate}
          variant="default"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Simpan Konfigurasi
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Tab Components
// ============================================================================

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-[14px]"
      />
      {suffix && (
        <span className="text-[13px] text-gray-500 whitespace-nowrap">
          {suffix}
        </span>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-10 h-5 rounded-full transition-colors ${checked ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </div>
      <span className="text-[13px] text-gray-700 dark:text-gray-300">
        {label}
      </span>
    </label>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">
          {title}
        </h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

type TabProps = {
  config: PayrollConfig;
  setConfig: React.Dispatch<React.SetStateAction<PayrollConfig | null>>;
};

function BpjsTab({ config, setConfig }: TabProps) {
  const update = (
    program: keyof PayrollConfig["bpjs"],
    field: string,
    value: number | null,
  ) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const currentProgram = prev.bpjs[program];
      return {
        ...prev,
        bpjs: {
          ...prev.bpjs,
          [program]: { ...currentProgram, [field]: value },
        },
      };
    });
  };

  return (
    <div className="space-y-6">
      <SectionCard title="BPJS Kesehatan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Iuran Karyawan"
            hint="Persentase dari gaji (0.01 = 1%)"
          >
            <NumberInput
              value={config.bpjs.kesehatan.employeeRate}
              onChange={(v) => update("kesehatan", "employeeRate", v)}
            />
          </FormField>
          <FormField
            label="Iuran Perusahaan"
            hint="Persentase dari gaji (0.04 = 4%)"
          >
            <NumberInput
              value={config.bpjs.kesehatan.employerRate}
              onChange={(v) => update("kesehatan", "employerRate", v)}
            />
          </FormField>
          <FormField
            label="Batas Maksimum Gaji"
            hint="Cap untuk perhitungan (null = tanpa batas)"
          >
            <NumberInput
              value={config.bpjs.kesehatan.maxBase ?? 0}
              onChange={(v) => update("kesehatan", "maxBase", v || null)}
              suffix="Rp"
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="BPJS JHT (Jaminan Hari Tua)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Iuran Karyawan">
            <NumberInput
              value={config.bpjs.jht.employeeRate}
              onChange={(v) => update("jht", "employeeRate", v)}
            />
          </FormField>
          <FormField label="Iuran Perusahaan">
            <NumberInput
              value={config.bpjs.jht.employerRate}
              onChange={(v) => update("jht", "employerRate", v)}
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="BPJS JP (Jaminan Pensiun)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Iuran Karyawan">
            <NumberInput
              value={config.bpjs.jp.employeeRate}
              onChange={(v) => update("jp", "employeeRate", v)}
            />
          </FormField>
          <FormField label="Iuran Perusahaan">
            <NumberInput
              value={config.bpjs.jp.employerRate}
              onChange={(v) => update("jp", "employerRate", v)}
            />
          </FormField>
          <FormField label="Batas Maksimum Gaji" hint="Cap Rp10.042.000">
            <NumberInput
              value={config.bpjs.jp.maxBase ?? 0}
              onChange={(v) => update("jp", "maxBase", v || null)}
              suffix="Rp"
            />
          </FormField>
          <FormField label="Batas Usia" hint="Tidak berlaku di atas usia ini">
            <NumberInput
              value={config.bpjs.jp.maxAge}
              onChange={(v) => update("jp", "maxAge", v)}
              suffix="tahun"
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="BPJS JKK & JKM (Ditanggung Perusahaan)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="JKK (Jaminan Kecelakaan Kerja)"
            hint="0.0024 = 0.24% (kategori risiko 1)"
          >
            <NumberInput
              value={config.bpjs.jkk.employerRate}
              onChange={(v) => update("jkk", "employerRate", v)}
            />
          </FormField>
          <FormField label="JKM (Jaminan Kematian)" hint="0.003 = 0.3%">
            <NumberInput
              value={config.bpjs.jkm.employerRate}
              onChange={(v) => update("jkm", "employerRate", v)}
            />
          </FormField>
        </div>
      </SectionCard>
    </div>
  );
}

function TaxTab({ config, setConfig }: TabProps) {
  const update = (field: string, value: string | number | boolean | null) => {
    setConfig((prev) =>
      prev ? { ...prev, tax: { ...prev.tax, [field]: value } } : prev,
    );
  };

  return (
    <SectionCard title="Pengaturan PPh 21">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Metode Default">
          <select
            value={config.tax.defaultMethod}
            onChange={(e) => update("defaultMethod", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]"
          >
            <option value="NET">NET (Karyawan tanggung)</option>
            <option value="GROSS_UP">
              GROSS UP (Perusahaan tanggung penuh)
            </option>
            <option value="NETT">
              NETT (Perusahaan tanggung, tidak masuk penghasilan)
            </option>
          </select>
        </FormField>
        <FormField label="Surcharge Tanpa NPWP" hint="0.20 = 20% tambahan">
          <NumberInput
            value={config.tax.npwpSurcharge}
            onChange={(v) => update("npwpSurcharge", v)}
          />
        </FormField>
        <FormField label="Biaya Jabatan (Rate)" hint="0.05 = 5%">
          <NumberInput
            value={config.tax.biayaJabatanRate}
            onChange={(v) => update("biayaJabatanRate", v)}
          />
        </FormField>
        <FormField label="Biaya Jabatan Max/Bulan" hint="Maksimum per bulan">
          <NumberInput
            value={config.tax.biayaJabatanMax}
            onChange={(v) => update("biayaJabatanMax", v)}
            suffix="Rp"
          />
        </FormField>
        <FormField label="Biaya Jabatan Max/Tahun">
          <NumberInput
            value={config.tax.biayaJabatanMaxAnnual}
            onChange={(v) => update("biayaJabatanMaxAnnual", v)}
            suffix="Rp"
          />
        </FormField>
        <FormField label="Bulan Koreksi Tahunan" hint="12 = Desember">
          <NumberInput
            value={config.tax.annualCorrectionMonth}
            onChange={(v) => update("annualCorrectionMonth", v)}
          />
        </FormField>
      </div>
    </SectionCard>
  );
}

function OvertimeTab({ config, setConfig }: TabProps) {
  const update = (field: string, value: string | number | boolean | null) => {
    setConfig((prev) =>
      prev ? { ...prev, overtime: { ...prev.overtime, [field]: value } } : prev,
    );
  };

  return (
    <SectionCard title="Pengaturan Lembur">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Maks Jam/Hari" hint="PP 35/2021: max 4 jam">
          <NumberInput
            value={config.overtime.maxHoursPerDay}
            onChange={(v) => update("maxHoursPerDay", v)}
            suffix="jam"
          />
        </FormField>
        <FormField label="Maks Jam/Minggu" hint="PP 35/2021: max 18 jam">
          <NumberInput
            value={config.overtime.maxHoursPerWeek}
            onChange={(v) => update("maxHoursPerWeek", v)}
            suffix="jam"
          />
        </FormField>
        <FormField label="Basis Rate" hint="1/173 = standar Depnaker">
          <select
            value={config.overtime.rateBase}
            onChange={(e) => update("rateBase", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]"
          >
            <option value="1/173">1/173 (Standar Depnaker)</option>
            <option value="custom">Custom</option>
          </select>
        </FormField>
        <FormField label="Enforcement Cap">
          <select
            value={config.overtime.capEnforcement}
            onChange={(e) => update("capEnforcement", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]"
          >
            <option value="SOFT_WARNING">
              Warning (tetap hitung, tampilkan peringatan)
            </option>
            <option value="HARD_BLOCK">Block (tidak hitung di atas cap)</option>
            <option value="NONE">
              None (hitung normal, tanpa enforcement)
            </option>
          </select>
        </FormField>
      </div>
    </SectionCard>
  );
}

function ThrTab({ config, setConfig }: TabProps) {
  const update = (field: string, value: string | number | boolean | null) => {
    setConfig((prev) =>
      prev
        ? { ...prev, thrConfig: { ...prev.thrConfig, [field]: value } }
        : prev,
    );
  };

  return (
    <SectionCard title="Pengaturan THR (Tunjangan Hari Raya)">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Eligible Setelah"
          hint="Minimal masa kerja untuk dapat THR"
        >
          <NumberInput
            value={config.thrConfig.eligibleAfterMonths}
            onChange={(v) => update("eligibleAfterMonths", v)}
            suffix="bulan"
          />
        </FormField>
        <FormField
          label="Full Entitlement"
          hint="Masa kerja untuk THR penuh (1x gaji)"
        >
          <NumberInput
            value={config.thrConfig.fullEntitlementMonths}
            onChange={(v) => update("fullEntitlementMonths", v)}
            suffix="bulan"
          />
        </FormField>
        <FormField label="Deadline Pembayaran" hint="H-N sebelum hari raya">
          <NumberInput
            value={config.thrConfig.paymentDeadlineDays}
            onChange={(v) => update("paymentDeadlineDays", v)}
            suffix="hari"
          />
        </FormField>
        <div className="flex items-end pb-4">
          <Toggle
            checked={config.thrConfig.prorata}
            onChange={(v) => update("prorata", v)}
            label="Prorata untuk masa kerja < full entitlement"
          />
        </div>
      </div>
    </SectionCard>
  );
}

function AdvanceTab({ config, setConfig }: TabProps) {
  const update = (field: string, value: string | number | boolean | null) => {
    setConfig((prev) =>
      prev
        ? { ...prev, advancePolicy: { ...prev.advancePolicy, [field]: value } }
        : prev,
    );
  };

  return (
    <SectionCard title="Pengaturan Kasbon / Salary Advance">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Maks % dari Gaji"
          hint="0.30 = maksimal 30% dari gaji pokok"
        >
          <NumberInput
            value={config.advancePolicy.maxPercentOfSalary}
            onChange={(v) => update("maxPercentOfSalary", v)}
          />
        </FormField>
        <FormField
          label="Maks Kasbon Aktif"
          hint="Jumlah kasbon aktif bersamaan"
        >
          <NumberInput
            value={config.advancePolicy.maxActiveAdvances}
            onChange={(v) => update("maxActiveAdvances", v)}
          />
        </FormField>
        <FormField
          label="Jarak Antar Request"
          hint="Minimal hari antara pengajuan"
        >
          <NumberInput
            value={config.advancePolicy.minDaysBetweenRequests}
            onChange={(v) => update("minDaysBetweenRequests", v)}
            suffix="hari"
          />
        </FormField>
        <FormField label="Maks Cicilan">
          <NumberInput
            value={config.advancePolicy.maxInstallments}
            onChange={(v) => update("maxInstallments", v)}
            suffix="kali"
          />
        </FormField>
        <FormField label="Metode Potongan">
          <select
            value={config.advancePolicy.deductionMethod}
            onChange={(e) => update("deductionMethod", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]"
          >
            <option value="FULL_NEXT">Potong penuh di gaji berikutnya</option>
            <option value="INSTALLMENT">Cicilan</option>
          </select>
        </FormField>
        <div className="flex items-end pb-4">
          <Toggle
            checked={config.advancePolicy.approvalRequired}
            onChange={(v) => update("approvalRequired", v)}
            label="Perlu approval atasan"
          />
        </div>
      </div>
    </SectionCard>
  );
}

function LockingTab({ config, setConfig }: TabProps) {
  const update = (field: string, value: string | number | boolean | null) => {
    setConfig((prev) =>
      prev
        ? { ...prev, periodLocking: { ...prev.periodLocking, [field]: value } }
        : prev,
    );
  };

  return (
    <SectionCard title="Pengaturan Period Locking">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Delay Auto-Lock"
          hint="Hari setelah pembayaran sebelum auto-lock"
        >
          <NumberInput
            value={config.periodLocking.autoLockDelayDays}
            onChange={(v) => update("autoLockDelayDays", v)}
            suffix="hari"
          />
        </FormField>
        <FormField
          label="Maks Unlock"
          hint="Berapa kali period boleh di-unlock"
        >
          <NumberInput
            value={config.periodLocking.maxUnlockCount}
            onChange={(v) => update("maxUnlockCount", v)}
            suffix="kali"
          />
        </FormField>
        <div className="flex items-end pb-4">
          <Toggle
            checked={config.periodLocking.autoLockAfterPaid}
            onChange={(v) => update("autoLockAfterPaid", v)}
            label="Auto-lock setelah dibayar"
          />
        </div>
        <div className="flex items-end pb-4">
          <Toggle
            checked={config.periodLocking.requireApprovalToUnlock}
            onChange={(v) => update("requireApprovalToUnlock", v)}
            label="Perlu approval untuk unlock"
          />
        </div>
      </div>
    </SectionCard>
  );
}
