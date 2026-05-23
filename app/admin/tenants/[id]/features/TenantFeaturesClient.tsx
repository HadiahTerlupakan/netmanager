"use client";

import { clientLogger } from "@/lib/client-logger";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineCheck,
  HiOutlineSquares2X2,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { toast } from "react-hot-toast";
import { useApi } from "@/lib/hooks/useApi";

interface FeatureFlagItem {
  feature: string;
  label: string;
  description: string;
  group: string;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface ListResponse {
  data?: { items: FeatureFlagItem[] } | { items: FeatureFlagItem[] };
  items?: FeatureFlagItem[];
}

const GROUP_ORDER = ["core", "operasional", "keuangan", "sdm", "lainnya"];
const GROUP_LABEL: Record<string, string> = {
  core: "Inti",
  operasional: "Operasional",
  keuangan: "Keuangan",
  sdm: "SDM",
  lainnya: "Lainnya",
};

export default function TenantFeaturesClient({
  tenantId,
}: {
  tenantId: string;
}) {
  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useApi<ListResponse>(`/api/admin/tenants/${tenantId}/feature-flags`);

  const items = useMemo<FeatureFlagItem[]>(() => {
    if (!response) return [];
    if (Array.isArray((response as { items?: FeatureFlagItem[] }).items)) {
      return (response as { items: FeatureFlagItem[] }).items;
    }
    const data = (response as { data?: { items?: FeatureFlagItem[] } }).data;
    return data?.items ?? [];
  }, [response]);

  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>(
    {},
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (error) {
      clientLogger.error("Gagal memuat feature flags", error);
      toast.error(error.message || "Gagal memuat feature flags");
    }
  }, [error]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, FeatureFlagItem[]>();
    for (const item of items) {
      const list = buckets.get(item.group) ?? [];
      list.push(item);
      buckets.set(item.group, list);
    }
    return GROUP_ORDER.filter((g) => buckets.has(g)).map((g) => ({
      group: g,
      label: GROUP_LABEL[g] ?? g,
      items: buckets.get(g) ?? [],
    }));
  }, [items]);

  const hasChanges = Object.keys(pendingChanges).length > 0;

  const handleToggle = (feature: string, currentEnabled: boolean) => {
    setPendingChanges((prev) => {
      const next = { ...prev };
      const newValue = !currentEnabled;
      // Hapus dari pending bila kembali ke nilai asli (no-op)
      const original = items.find((i) => i.feature === feature);
      if (original && original.enabled === newValue) {
        delete next[feature];
      } else {
        next[feature] = newValue;
      }
      return next;
    });
  };

  const effectiveValue = (item: FeatureFlagItem): boolean => {
    return Object.prototype.hasOwnProperty.call(pendingChanges, item.feature)
      ? pendingChanges[item.feature]
      : item.enabled;
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    const updates = Object.entries(pendingChanges).map(
      ([feature, enabled]) => ({
        feature,
        enabled,
      }),
    );

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/feature-flags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${updates.length} modul diperbarui`);
        setPendingChanges({});
        await mutate();
      } else {
        toast.error(data.error || "Gagal menyimpan perubahan");
      }
    } catch (err) {
      clientLogger.error("Error saving feature flags:", err);
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <PageLoader variant="section" message="Memuat modul..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/tenants"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
          >
            <HiOutlineArrowLeft className="w-4 h-4" />
            Kembali ke daftar tenant
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineSquares2X2 className="w-6 h-6" />
            Atur Modul Tenant
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Aktifkan atau nonaktifkan modul untuk tenant ini. Tenant tidak akan
            melihat menu modul yang dinonaktifkan dan API terkait akan menolak
            akses.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <HiOutlineCheck className="w-5 h-5" />
          {isSaving
            ? "Menyimpan..."
            : hasChanges
              ? `Simpan (${Object.keys(pendingChanges).length})`
              : "Tidak ada perubahan"}
        </button>
      </div>

      <div className="space-y-6">
        {grouped.map((section) => (
          <section
            key={section.group}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <header className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                {section.label}
              </h2>
            </header>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {section.items.map((item) => {
                const enabled = effectiveValue(item);
                const isDirty = Object.prototype.hasOwnProperty.call(
                  pendingChanges,
                  item.feature,
                );
                return (
                  <li
                    key={item.feature}
                    className="px-6 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.label}
                        </h3>
                        <code className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {item.feature}
                        </code>
                        {isDirty ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            Belum disimpan
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {item.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => handleToggle(item.feature, enabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        enabled
                          ? "bg-indigo-600 dark:bg-indigo-500"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
