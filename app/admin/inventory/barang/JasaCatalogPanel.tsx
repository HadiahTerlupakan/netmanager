"use client";

import { useState } from "react";
import { FiPlus } from "react-icons/fi";

import { usePermission } from "@/hooks/use-permission";
import type { Jasa } from "../restock/types";
import JasaFormModal from "./JasaFormModal";
import JasaList from "./JasaList";
import {
  CATALOG_HEADER_ACTION_CLASS,
  InventoryCatalogShell,
} from "./InventoryCatalogShell";
import type { InventoryCatalogTab } from "./catalogTabs";

type JasaCatalogPanelProps = {
  visibleTabs: readonly InventoryCatalogTab[];
};

/** Tab Jasa: daftar jasa non-fisik dengan tombol "Tambah Jasa" (jasa:create) dan modal formnya. */
export function JasaCatalogPanel({ visibleTabs }: JasaCatalogPanelProps) {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("jasa:create");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJasa, setEditingJasa] = useState<Jasa | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const openCreateModal = () => {
    setEditingJasa(null);
    setIsModalOpen(true);
  };

  const openEditModal = (jasa: Jasa) => {
    setEditingJasa(jasa);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingJasa(null);
  };

  const handleSaved = () => {
    closeModal();
    setReloadKey((key) => key + 1);
  };

  const headerAction = canCreate ? (
    <button
      type="button"
      onClick={openCreateModal}
      className={CATALOG_HEADER_ACTION_CLASS}
    >
      <FiPlus className="h-4 w-4 mr-2 text-white" />
      <span className="text-white">Tambah Jasa</span>
    </button>
  ) : null;

  return (
    <InventoryCatalogShell
      activeTab="jasa"
      visibleTabs={visibleTabs}
      headerAction={headerAction}
    >
      <JasaList reloadKey={reloadKey} onEdit={openEditModal} />
      <JasaFormModal
        key={editingJasa?.id ?? "create"}
        isOpen={isModalOpen}
        editingJasa={editingJasa}
        onClose={closeModal}
        onSuccess={handleSaved}
      />
    </InventoryCatalogShell>
  );
}
