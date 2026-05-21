"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import {
  HiOutlinePlusCircle,
  HiOutlinePencilSquare,
  HiOutlineArrowLeft,
  HiOutlineCog6Tooth,
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

interface PayrollComponent {
  id: string;
  name: string;
  code: string;
  category: "EARNING" | "DEDUCTION" | "BENEFIT";
  calculationType: "FIXED" | "PERCENTAGE" | "FORMULA";
  defaultAmount: number | null;
  percentageBase: string | null;
  percentageRate: number | null;
  isActive: boolean;
  isTaxable: boolean;
  description: string | null;
}

interface ComponentsResponse {
  components: PayrollComponent[];
}

interface ComponentFormData {
  name: string;
  code: string;
  category: "EARNING" | "DEDUCTION" | "BENEFIT";
  calculationType: "FIXED" | "PERCENTAGE" | "FORMULA";
  defaultAmount: number | null;
  percentageRate: number | null;
  isActive: boolean;
  isTaxable: boolean;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  EARNING: "Pendapatan",
  DEDUCTION: "Potongan",
  BENEFIT: "Benefit",
};

const CATEGORY_COLORS: Record<string, string> = {
  EARNING:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DEDUCTION: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  BENEFIT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const CALC_TYPE_LABELS: Record<string, string> = {
  FIXED: "Nominal Tetap",
  PERCENTAGE: "Persentase",
  FORMULA: "Formula",
};

const INITIAL_FORM: ComponentFormData = {
  name: "",
  code: "",
  category: "EARNING",
  calculationType: "FIXED",
  defaultAmount: null,
  percentageRate: null,
  isActive: true,
  isTaxable: true,
  description: "",
};

// ============================================================================
// Component
// ============================================================================

export default function ComponentsClient() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ComponentFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const {
    data: response,
    isLoading: loading,
    mutate: refetch,
  } = useApi<ComponentsResponse>("/api/admin/salary/components");

  const components = response?.components ?? [];

  /** Open modal for creating new component */
  const handleCreate = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setModalOpen(true);
  };

  /** Open modal for editing existing component */
  const handleEdit = (component: PayrollComponent) => {
    setEditingId(component.id);
    setForm({
      name: component.name,
      code: component.code,
      category: component.category,
      calculationType: component.calculationType,
      defaultAmount: component.defaultAmount,
      percentageRate: component.percentageRate,
      isActive: component.isActive,
      isTaxable: component.isTaxable,
      description: component.description || "",
    });
    setModalOpen(true);
  };

  /** Save component (create or update) */
  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/salary/components/${editingId}`
        : "/api/admin/salary/components";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        refetch();
      } else {
        alert(data.error || "Gagal menyimpan komponen");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  /** Toggle active status */
  const handleToggleActive = async (component: PayrollComponent) => {
    try {
      const res = await fetch(`/api/admin/salary/components/${component.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !component.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        refetch();
      } else {
        alert(data.error || "Gagal mengubah status");
      }
    } catch {
      alert("Terjadi kesalahan");
    }
  };

  // Table columns
  const columns: Column<PayrollComponent>[] = [
    {
      key: "name",
      header: "Nama Komponen",
      priority: "primary",
      minWidth: "180px",
      render: (item) => (
        <div className="py-1">
          <div className="font-semibold text-gray-900 dark:text-white">
            {item.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {item.code}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Kategori",
      priority: "primary",
      align: "center",
      render: (item) => (
        <Badge
          className={`${CATEGORY_COLORS[item.category]} border-none shadow-none text-[10px] font-bold px-2 py-0.5 rounded-full`}
        >
          {CATEGORY_LABELS[item.category]}
        </Badge>
      ),
    },
    {
      key: "calculationType",
      header: "Tipe Kalkulasi",
      priority: "secondary",
      render: (item) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {CALC_TYPE_LABELS[item.calculationType]}
        </span>
      ),
    },
    {
      key: "defaultAmount",
      header: "Nilai Default",
      priority: "secondary",
      align: "right",
      render: (item) => {
        if (
          item.calculationType === "PERCENTAGE" &&
          item.percentageRate !== null
        ) {
          return <span className="text-sm">{item.percentageRate}%</span>;
        }
        if (item.defaultAmount !== null) {
          return (
            <span className="text-sm">
              {new Intl.NumberFormat("id-ID").format(item.defaultAmount)}
            </span>
          );
        }
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      key: "isTaxable",
      header: "Kena Pajak",
      priority: "tertiary",
      align: "center",
      render: (item) => (
        <span
          className={`text-xs font-medium ${item.isTaxable ? "text-orange-600" : "text-gray-400"}`}
        >
          {item.isTaxable ? "Ya" : "Tidak"}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      priority: "primary",
      align: "center",
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleActive(item);
          }}
          className={`px-2 py-1 rounded-full text-[10px] font-bold transition-colors ${
            item.isActive
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200"
              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200"
          }`}
        >
          {item.isActive ? "Aktif" : "Nonaktif"}
        </button>
      ),
    },
  ];

  const renderActions = (item: PayrollComponent) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleEdit(item);
      }}
      className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full text-gray-500 hover:text-indigo-600 transition-all active:scale-95"
      title="Edit"
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
              Komponen Payroll
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Kelola komponen pendapatan, potongan, dan benefit
            </p>
          </div>
        </div>
        <Button onClick={handleCreate}>
          <HiOutlinePlusCircle className="w-4 h-4 mr-2" />
          Tambah Komponen
        </Button>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Komponen</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            data={components}
            columns={columns}
            keyField="id"
            loading={loading}
            emptyMessage={
              <div className="text-center py-12">
                <HiOutlineCog6Tooth className="w-16 h-16 mx-auto mb-4 text-gray-200 dark:text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Belum Ada Komponen
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Tambahkan komponen payroll untuk memulai konfigurasi.
                </p>
                <Button onClick={handleCreate} className="mt-6">
                  Tambah Komponen &rarr;
                </Button>
              </div>
            }
            renderActions={renderActions}
            onRowClick={(item) => handleEdit(item)}
            className="border-none"
          />
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Komponen" : "Tambah Komponen Baru"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Nama Komponen
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                placeholder="Tunjangan Transport"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Kode
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                placeholder="TJ_TRANSPORT"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Kategori
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as ComponentFormData["category"],
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
              >
                <option value="EARNING">Pendapatan</option>
                <option value="DEDUCTION">Potongan</option>
                <option value="BENEFIT">Benefit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Tipe Kalkulasi
              </label>
              <select
                value={form.calculationType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    calculationType: e.target
                      .value as ComponentFormData["calculationType"],
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
              >
                <option value="FIXED">Nominal Tetap</option>
                <option value="PERCENTAGE">Persentase</option>
                <option value="FORMULA">Formula</option>
              </select>
            </div>
          </div>

          {form.calculationType === "FIXED" && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Nominal Default
              </label>
              <input
                type="number"
                value={form.defaultAmount ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    defaultAmount: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                placeholder="500000"
              />
            </div>
          )}

          {form.calculationType === "PERCENTAGE" && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Persentase (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.percentageRate ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    percentageRate: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
                placeholder="5.0"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Deskripsi
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-900 dark:text-gray-50"
              placeholder="Deskripsi komponen (opsional)"
            />
          </div>

          <div className="flex items-center gap-6">
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
                Aktif
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isTaxable}
                onChange={(e) =>
                  setForm({ ...form, isTaxable: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Kena Pajak
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name || !form.code}
            >
              {saving
                ? "Menyimpan..."
                : editingId
                  ? "Simpan Perubahan"
                  : "Tambah Komponen"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
