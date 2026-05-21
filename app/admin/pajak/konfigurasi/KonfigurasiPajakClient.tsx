"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { HiOutlineCog6Tooth } from "react-icons/hi2";
import { usePermission } from "@/hooks/use-permission";
import toast from "react-hot-toast";

interface TaxConfig {
  npwp: string | null;
  companyName: string | null;
  isPkp: boolean;
  ppnRate: number;
  ppnIncluded: boolean;
  pph23RateJasa: number;
  pph23RateSewa: number;
  pph4Rate: number;
  bhpRate: number;
  usoRate: number;
  ksoRate: number;
  ppnDueDay: number;
  pph21DueDay: number;
  pph23DueDay: number;
  bhpDueMonth: number;
}

export function KonfigurasiPajakClient() {
  const { hasPermission } = usePermission();
  const canManage = hasPermission("tax:manage");

  const [config, setConfig] = useState<TaxConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchedRef = useRef(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tax/config");
      if (res.ok) {
        const json = await res.json();
        setConfig(json.data);
      }
    } catch {
      toast.error("Gagal memuat konfigurasi pajak");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchConfig();
    }
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tax/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const json = await res.json();
        setConfig(json.data);
        toast.success("Konfigurasi berhasil disimpan");
      } else {
        const err = await res.json();
        toast.error(err.message || "Gagal menyimpan");
      }
    } catch {
      toast.error("Gagal menyimpan konfigurasi");
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof TaxConfig>(
    key: K,
    value: TaxConfig[K],
  ) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <HiOutlineCog6Tooth className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">
          Konfigurasi Pajak
        </h1>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 p-6 space-y-6">
        {/* Identitas */}
        <div>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
            Identitas Perusahaan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                NPWP
              </label>
              <input
                type="text"
                value={config.npwp || ""}
                onChange={(e) => updateField("npwp", e.target.value || null)}
                disabled={!canManage}
                placeholder="XX.XXX.XXX.X-XXX.XXX"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nama Perusahaan
              </label>
              <input
                type="text"
                value={config.companyName || ""}
                onChange={(e) =>
                  updateField("companyName", e.target.value || null)
                }
                disabled={!canManage}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white disabled:opacity-60"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.isPkp}
                onChange={(e) => updateField("isPkp", e.target.checked)}
                disabled={!canManage}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
            </label>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Pengusaha Kena Pajak (PKP)
            </span>
          </div>
        </div>

        {/* Tarif */}
        <div>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
            Tarif Pajak (%)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FieldNumber
              label="Tarif PPN"
              value={config.ppnRate}
              onChange={(v) => updateField("ppnRate", v)}
              disabled={!canManage}
            />
            <FieldNumber
              label="PPh 23 Jasa"
              value={config.pph23RateJasa}
              onChange={(v) => updateField("pph23RateJasa", v)}
              disabled={!canManage}
            />
            <FieldNumber
              label="PPh 23 Sewa"
              value={config.pph23RateSewa}
              onChange={(v) => updateField("pph23RateSewa", v)}
              disabled={!canManage}
            />
            <FieldNumber
              label="PPh 4(2)"
              value={config.pph4Rate}
              onChange={(v) => updateField("pph4Rate", v)}
              disabled={!canManage}
            />
            <FieldNumber
              label="BHP"
              value={config.bhpRate}
              onChange={(v) => updateField("bhpRate", v)}
              disabled={!canManage}
            />
            <FieldNumber
              label="USO"
              value={config.usoRate}
              onChange={(v) => updateField("usoRate", v)}
              disabled={!canManage}
            />
          </div>
        </div>

        {/* Jatuh Tempo */}
        <div>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
            Tanggal Jatuh Tempo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FieldNumber
              label="PPN (tanggal)"
              value={config.ppnDueDay}
              onChange={(v) => updateField("ppnDueDay", v)}
              disabled={!canManage}
            />
            <FieldNumber
              label="PPh 21 (tanggal)"
              value={config.pph21DueDay}
              onChange={(v) => updateField("pph21DueDay", v)}
              disabled={!canManage}
            />
            <FieldNumber
              label="PPh 23 (tanggal)"
              value={config.pph23DueDay}
              onChange={(v) => updateField("pph23DueDay", v)}
              disabled={!canManage}
            />
            <FieldNumber
              label="BHP (bulan ke-)"
              value={config.bhpDueMonth}
              onChange={(v) => updateField("bhpDueMonth", v)}
              disabled={!canManage}
            />
          </div>
        </div>

        {/* Save */}
        {canManage && (
          <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white disabled:opacity-60"
      />
    </div>
  );
}
