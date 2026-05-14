"use client";

import { useState } from "react";
import Link from "next/link";
import { FiDownload, FiPlus } from "react-icons/fi";
import { MasukForm } from "@/components/inventory/MasukForm";
import { MasukTable } from "@/components/inventory/MasukTable";
import DetailMasukModal from "@/components/inventory/DetailMasukModal";
import { usePermission } from "@/hooks/use-permission";
import { Modal } from "@/components/ui/Modal";
import { useInventoryFilters } from "../hooks/useInventoryFilters";
import { InventoryFilterBar } from "../components/InventoryFilterBar";
import type { FotoMetadata } from "../hooks/useInventoryFilters";

interface BarangMasuk {
  id: string;
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi: "BARU" | "BEKAS" | "RUSAK";
  keterangan: string | null;
  tanggal: string;
  createdAt: string;
  employeeId?: string | null;
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

export default function BarangMasukPage() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("masuk:create");
  const canUpdate = hasPermission("masuk:update");

  const [showForm, setShowForm] = useState(false);
  const [editingMasuk, setEditingMasuk] = useState<BarangMasuk | null>(null);
  const [viewingMasuk, setViewingMasuk] = useState<BarangMasuk | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { filters, setFilter, sites, gudangs } = useInventoryFilters();

  const handleEdit = (masuk: BarangMasuk) => {
    setEditingMasuk(masuk);
    setShowForm(true);
  };

  const handleView = (masuk: BarangMasuk) => {
    setViewingMasuk(masuk);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingMasuk(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleViewClose = () => {
    setViewingMasuk(null);
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
            <FiDownload className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Barang Masuk
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Kelola catatan barang yang masuk ke gudang
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <FiPlus className="h-4 w-4 mr-2 text-white" />
            <span className="text-white">Barang Masuk</span>
          </button>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={handleFormClose}
        title={editingMasuk ? "Edit Barang Masuk" : "Catat Barang Masuk"}
        size="lg"
      >
        <MasukForm initialData={editingMasuk} onClose={handleFormClose} />
      </Modal>

      {/* List Container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Riwayat Barang Masuk
          </h2>
        </div>

        {/* Filters */}
        <InventoryFilterBar
          filters={filters}
          onFilterChange={setFilter}
          sites={sites}
          gudangs={gudangs}
          colorVariant="green"
        />

        <div className="p-6">
          <MasukTable
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
      <DetailMasukModal
        masuk={viewingMasuk}
        isOpen={!!viewingMasuk}
        onClose={handleViewClose}
        onEdit={canUpdate ? handleEdit : undefined}
      />
    </div>
  );
}
