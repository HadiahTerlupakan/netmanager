"use client";

import { useState } from "react";
import Link from "next/link";
import { FiUpload, FiPlus } from "react-icons/fi";
import { KeluarForm } from "@/components/inventory/KeluarForm";
import { KeluarTable } from "@/components/inventory/KeluarTable";
import { DetailKeluarModal } from "@/components/inventory/DetailKeluarModal";
import { usePermission } from "@/hooks/use-permission";
import { Modal } from "@/components/ui/Modal";
import { useInventoryFilters } from "../hooks/useInventoryFilters";
import { InventoryFilterBar } from "../components/InventoryFilterBar";
import type { FotoMetadata } from "../hooks/useInventoryFilters";

interface BarangKeluar {
  id: string;
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi: "BARU" | "BEKAS" | "RUSAK";
  isHilang?: boolean;
  keterangan: string | null;
  tanggal: string;
  createdAt: string;
  employeeId?: string | null;
  purpose?: string | null;
  fotoBukti: string[];
  fotoMetadata?: FotoMetadata;
  barang: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
  };
  gudang: {
    id: string;
    kode: string;
    nama: string;
  };
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export default function BarangKeluarPage() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("keluar:create");
  const canUpdate = hasPermission("keluar:update");

  const [showForm, setShowForm] = useState(false);
  const [editingKeluar, setEditingKeluar] = useState<BarangKeluar | null>(null);
  const [viewingKeluar, setViewingKeluar] = useState<BarangKeluar | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { filters, setFilter, sites, gudangs } = useInventoryFilters();

  const handleEdit = (keluar: BarangKeluar) => {
    setEditingKeluar(keluar);
    setShowForm(true);
  };

  const handleView = (keluar: BarangKeluar) => {
    setViewingKeluar(keluar);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingKeluar(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleViewClose = () => {
    setViewingKeluar(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href="/admin/inventory"
            className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FiUpload className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Barang Keluar
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Kelola catatan barang yang keluar dari gudang
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <FiPlus className="h-4 w-4 mr-2 text-white" />
            <span className="text-white">Barang Keluar</span>
          </button>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={handleFormClose}
        title={editingKeluar ? "Edit Barang Keluar" : "Catat Barang Keluar"}
        size="lg"
      >
        <KeluarForm initialData={editingKeluar} onClose={handleFormClose} />
      </Modal>

      {/* List Container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Riwayat Barang Keluar
          </h2>
        </div>

        {/* Filters */}
        <InventoryFilterBar
          filters={filters}
          onFilterChange={setFilter}
          sites={sites}
          gudangs={gudangs}
          colorVariant="orange"
        />

        <div className="p-6">
          <KeluarTable
            onEdit={canUpdate ? handleEdit : undefined}
            onView={handleView}
            refreshTrigger={refreshTrigger}
            search={filters.search}
            startDate={filters.startDate}
            endDate={filters.endDate}
            siteId={filters.siteId}
            gudangId={filters.gudangId}
          />
        </div>
      </div>

      {/* Detail Modal */}
      <DetailKeluarModal
        keluar={viewingKeluar}
        isOpen={!!viewingKeluar}
        onClose={handleViewClose}
        onEdit={canUpdate ? handleEdit : undefined}
      />
    </div>
  );
}
