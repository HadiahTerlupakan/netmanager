"use client";

import React, { useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";
import type { MappingNode, MappingEdge } from "@prisma/client";

interface EdgeFormModalProps {
  edge: MappingEdge | null;
  nodes: MappingNode[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<MappingEdge>) => void;
}

export function EdgeFormModal({ edge, nodes, isOpen, onClose, onSave }: EdgeFormModalProps) {
  const [formData, setFormData] = useState({
    source: "",
    target: "",
    fiberType: "distribution",
    distance: 0,
    notes: "",
  });

  const isEditing = !!edge?.edgeId;

  const [prevEdge, setPrevEdge] = useState(edge);

  if (edge !== prevEdge) {
    setPrevEdge(edge);
    setFormData({
      source: edge?.source || "",
      target: edge?.target || "",
      fiberType: edge?.fiberType || "distribution",
      distance: edge?.distance || 0,
      notes: edge?.notes || "",
    });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      distance: formData.distance ? Number(formData.distance) : undefined,
    });
  };

  const fiberTypeOptions = [
    { value: "feeder", label: "Feeder (Backbone)" },
    { value: "distribution", label: "Distribution" },
    { value: "drop", label: "Drop Cable" },
    { value: "odc_to_odc", label: "ODC ke ODC" },
    { value: "odp_to_odp", label: "ODP ke ODP" },
  ];

  const sourceNode = nodes.find((n) => n.nodeId === formData.source);
  const targetNode = nodes.find((n) => n.nodeId === formData.target);

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Koneksi Fiber" : "Tambah Koneksi Fiber"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Source Info */}
          <div className="col-span-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Source</p>
                <p className="font-medium text-gray-900 dark:text-white">{sourceNode?.name || formData.source}</p>
                <p className="text-xs text-gray-400">{sourceNode?.type?.toUpperCase()}</p>
              </div>
              <div className="text-2xl text-gray-400">→</div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">Target</p>
                <p className="font-medium text-gray-900 dark:text-white">{targetNode?.name || formData.target}</p>
                <p className="text-xs text-gray-400">{targetNode?.type?.toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Fiber Type */}
          <div className="col-span-2">
            <label className={labelClass}>Tipe Fiber</label>
            <Select
              options={fiberTypeOptions}
              value={formData.fiberType}
              onChange={(value) => setFormData({ ...formData, fiberType: value })}
              placeholder="Pilih tipe fiber"
            />
          </div>

          {/* Distance */}
          <div className="col-span-2">
            <label className={labelClass}>Jarak (meter)</label>
            <input
              type="number"
              value={formData.distance || ""}
              onChange={(e) => setFormData({ ...formData, distance: parseFloat(e.target.value) || 0 })}
              placeholder="Jarak kabel dalam meter"
              min={0}
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
            {isEditing ? "Simpan Perubahan" : "Tambah Koneksi"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
