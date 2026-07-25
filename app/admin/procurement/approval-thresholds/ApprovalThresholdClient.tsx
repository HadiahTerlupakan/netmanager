"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import {
  ProcurementListCard,
  ProcurementPageShell,
  PROCUREMENT_INPUT_CLASS,
} from "../_components/ProcurementPageShell";

interface ApprovalThreshold {
  id: string;
  scope: string;
  roleId: string;
  roleName: string | null;
  minAmount: number;
  maxAmount: number | null;
  description: string | null;
  isActive: boolean;
}

interface RoleOption {
  id: string;
  name: string;
}

const SCOPE_LABEL: Record<string, string> = {
  PURCHASE_REQUEST: "Purchase Request",
  PURCHASE_ORDER: "Purchase Order",
};

const ID_FORMATTER = new Intl.NumberFormat("id-ID");

function formatRupiah(n: number): string {
  return `Rp ${ID_FORMATTER.format(Math.round(n))}`;
}

interface FormState {
  scope: "PURCHASE_REQUEST" | "PURCHASE_ORDER";
  roleId: string;
  minAmount: string;
  maxAmount: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  scope: "PURCHASE_ORDER",
  roleId: "",
  minAmount: "0",
  maxAmount: "",
  description: "",
};

export function ApprovalThresholdClient() {
  const [scopeFilter, setScopeFilter] = useState<string>("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);

  const queryString = scopeFilter ? `?scope=${scopeFilter}` : "";
  const { data, error, isLoading, mutate } = useApi<ApprovalThreshold[]>(
    `/api/admin/procurement/approval-thresholds${queryString}`,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/roles");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const list: RoleOption[] = (json?.data ?? json ?? []).map(
          (r: { id: string; name: string }) => ({ id: r.id, name: r.name }),
        );
        setRoles(list);
        if (list.length > 0 && !form.roleId)
          setForm((prev) => ({ ...prev, roleId: list[0].id }));
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Gagal memuat data threshold");
    }
  }, [error]);

  const items = data ?? [];

  const handleCreate = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!form.roleId) {
      toast.error("Role wajib dipilih");
      return;
    }
    const minAmount = parseFloat(form.minAmount);
    const maxAmount =
      form.maxAmount.trim() === "" ? null : parseFloat(form.maxAmount);
    if (!Number.isFinite(minAmount)) {
      toast.error("minAmount harus angka");
      return;
    }
    if (maxAmount !== null && !Number.isFinite(maxAmount)) {
      toast.error("maxAmount harus angka atau kosong");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/procurement/approval-thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: form.scope,
          roleId: form.roleId,
          minAmount,
          maxAmount,
          description: form.description || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal membuat threshold");
      }
      toast.success(json.message || "Threshold berhasil dibuat");
      setForm({ ...EMPTY_FORM, roleId: form.roleId });
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(
        `/api/admin/procurement/approval-thresholds/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !isActive }),
        },
      );
      if (!res.ok) {
        throw new Error((await res.json()).error || "Gagal update");
      }
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus threshold ini?")) return;
    try {
      const res = await fetch(
        `/api/admin/procurement/approval-thresholds/${id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        throw new Error((await res.json()).error || "Gagal menghapus");
      }
      toast.success("Threshold berhasil dihapus");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  };

  return (
    <ProcurementPageShell
      title="Approval Threshold"
      subtitle="Atur batas nominal yang dapat di-approve oleh setiap role per scope (PR / PO). Saat user membuat PO, sistem akan menolak nominal yang melebihi wewenang role-nya. Jika tidak ada threshold yang dikonfigurasi untuk scope tertentu, gating dinonaktifkan (backward compatible)."
      backHref="/admin/procurement"
    >
      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end"
      >
        <div className="sm:col-span-1">
          <label className="block text-xs text-gray-700 mb-1">Scope</label>
          <select
            value={form.scope}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                scope: e.target.value as FormState["scope"],
              }))
            }
            className="w-full h-10 px-3 rounded-lg border border-gray-100 bg-white text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="PURCHASE_ORDER">PO</option>
            <option value="PURCHASE_REQUEST">PR</option>
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs text-gray-700 mb-1">Role</label>
          <select
            value={form.roleId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, roleId: e.target.value }))
            }
            required
            className="w-full h-10 px-3 rounded-lg border border-gray-100 bg-white text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">— Pilih role —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs text-gray-700 mb-1">Min (Rp)</label>
          <input
            type="number"
            min={0}
            value={form.minAmount}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, minAmount: e.target.value }))
            }
            required
            className="w-full h-10 px-3 rounded-lg border border-gray-100 bg-white text-sm font-mono shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs text-gray-700 mb-1">
            Max (Rp, kosong = unlimited)
          </label>
          <input
            type="number"
            min={0}
            value={form.maxAmount}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, maxAmount: e.target.value }))
            }
            className="w-full h-10 px-3 rounded-lg border border-gray-100 bg-white text-sm font-mono shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs text-gray-700 mb-1">Catatan</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            maxLength={500}
            className="w-full h-10 px-3 rounded-lg border border-gray-100 bg-white text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="sm:col-span-1">
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Menyimpan..." : "Tambah"}
          </Button>
        </div>
      </form>

      <div className="mb-3">
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className={PROCUREMENT_INPUT_CLASS}
        >
          <option value="">Semua scope</option>
          <option value="PURCHASE_ORDER">PO</option>
          <option value="PURCHASE_REQUEST">PR</option>
        </select>
      </div>

      <ProcurementListCard>
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            <tr className="text-left text-gray-700">
              <th className="px-4 py-3 font-medium">Scope</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium text-right">Min</th>
              <th className="px-4 py-3 font-medium text-right">Max</th>
              <th className="px-4 py-3 font-medium">Catatan</th>
              <th className="px-4 py-3 font-medium">Aktif</th>
              <th className="px-4 py-3 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Memuat data...
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Belum ada threshold.
                </td>
              </tr>
            )}
            {items.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition"
              >
                <td className="px-4 py-3">{SCOPE_LABEL[t.scope] ?? t.scope}</td>
                <td className="px-4 py-3">{t.roleName ?? t.roleId}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatRupiah(t.minAmount)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {t.maxAmount === null ? "∞" : formatRupiah(t.maxAmount)}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {t.description ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(t.id, t.isActive)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      t.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {t.isActive ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ProcurementListCard>
    </ProcurementPageShell>
  );
}
