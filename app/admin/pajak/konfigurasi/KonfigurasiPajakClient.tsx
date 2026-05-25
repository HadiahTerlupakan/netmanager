"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { HiOutlineCog6Tooth } from "react-icons/hi2";
import { usePermission } from "@/hooks/use-permission";
import toast from "react-hot-toast";
import { TarifPajakFleksibelSection } from "./TarifPajakFleksibelSection";

interface TaxConfig {
  npwp: string | null;
  companyName: string | null;
  isPkp: boolean;
  ppnIncluded: boolean;
}

export function KonfigurasiPajakClient() {
  const { hasPermission } = usePermission();
  const canManage = hasPermission("tax:manage");

  const [config, setConfig] = useState<TaxConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"identitas" | "tarif">(
    "identitas",
  );

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

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1" aria-label="Tabs">
          <TabButton
            active={activeTab === "identitas"}
            onClick={() => setActiveTab("identitas")}
          >
            Identitas Perusahaan
          </TabButton>
          <TabButton
            active={activeTab === "tarif"}
            onClick={() => setActiveTab("tarif")}
          >
            Tarif Pajak per Jenis
          </TabButton>
        </nav>
      </div>

      {activeTab === "identitas" && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 p-6 space-y-6">
          {/* Identitas */}
          <div>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
              Identitas Perusahaan
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-2xl">
              Identitas yang dicetak di laporan pajak (SPT, Coretax). Status PKP
              menentukan apakah invoice ke pelanggan dipungut PPN.
            </p>
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

          {/* Tarif legacy & jatuh tempo dipindah ke tab "Tarif Pajak per Jenis"
              yang sumber datanya TaxRateConfig. */}

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
      )}

      {activeTab === "tarif" && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 p-6">
          <TarifPajakFleksibelSection canManage={canManage} />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
        active
          ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
          : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      {children}
    </button>
  );
}
