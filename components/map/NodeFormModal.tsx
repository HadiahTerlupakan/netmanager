"use client";

import React, { useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";
import type { MappingNode } from "@prisma/client";

interface NodeFormModalProps {
  node: MappingNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<MappingNode>) => void;
}

export function NodeFormModal({ node, isOpen, onClose, onSave }: NodeFormModalProps) {
  const [formData, setFormData] = useState({
    type: "odp" as string,
    name: "",
    latitude: 0,
    longitude: 0,
    capacity: 8,
    splitter: "",
    pppoe: "",
    serialNumber: "",
    notes: "",
  });

  const isEditing = !!node?.nodeId;

  const [prevNode, setPrevNode] = useState(node);

  if (node !== prevNode) {
    setPrevNode(node);
    setFormData({
        type: node?.type || "odp",
        name: node?.name || "",
        latitude: node?.latitude || 0,
        longitude: node?.longitude || 0,
        capacity: node?.capacity || 8,
        splitter: node?.splitter || "",
        pppoe: node?.pppoe || "",
        serialNumber: node?.serialNumber || "",
        notes: node?.notes || "",
    });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
      capacity: Number(formData.capacity),
    });
  };

  const nodeTypeOptions = [
    { value: "olt", label: "OLT / Server" },
    { value: "odc", label: "ODC (Optical Distribution Cabinet)" },
    { value: "odp", label: "ODP (Optical Distribution Point)" },
    { value: "ont", label: "ONT (Optical Network Terminal)" },
  ];

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Node" : "Tambah Node Baru"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Type */}
          <div className="col-span-2">
            <label className={labelClass}>Tipe Node</label>
            <Select
              options={nodeTypeOptions}
              value={formData.type}
              onChange={(value) => setFormData({ ...formData, type: value })}
              disabled={isEditing}
              placeholder="Pilih tipe"
            />
          </div>

          {/* Name */}
          <div className="col-span-2">
            <label className={labelClass}>Nama Node</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: ODP-JKT-001"
              required
              className={inputClass}
            />
          </div>

          {/* Latitude */}
          <div>
            <label className={labelClass}>Latitude</label>
            <input
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
              required
              className={inputClass}
            />
          </div>

          {/* Longitude */}
          <div>
            <label className={labelClass}>Longitude</label>
            <input
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
              required
              className={inputClass}
            />
          </div>

          {/* Capacity */}
          <div>
            <label className={labelClass}>Kapasitas (Port)</label>
            <input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
              min={0}
              className={inputClass}
            />
          </div>

          {/* Splitter */}
          <div>
            <label className={labelClass}>Splitter</label>
            <input
              type="text"
              value={formData.splitter}
              onChange={(e) => setFormData({ ...formData, splitter: e.target.value })}
              placeholder="1:8, 1:16, dll"
              className={inputClass}
            />
          </div>

          {/* Serial Number */}
          <div className="col-span-2">
            <label className={labelClass}>Serial Number</label>
            <input
              type="text"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              placeholder="S/N perangkat"
              className={inputClass}
            />
          </div>

          {/* PPPoE */}
          <div className="col-span-2">
            <label className={labelClass}>PPPoE Username</label>
            <input
              type="text"
              value={formData.pppoe}
              onChange={(e) => setFormData({ ...formData, pppoe: e.target.value })}
              placeholder="Username PPPoE (untuk ONT)"
              className={inputClass}
            />
          </div>

          {/* Notes */}
          <div className="col-span-2">
            <label className={labelClass}>Catatan</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Catatan tambahan..."
              rows={3}
              className={inputClass}
            />
          </div>
        </div>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isEditing ? "Simpan Perubahan" : "Tambah Node"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
