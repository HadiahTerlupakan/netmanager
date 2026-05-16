"use client";

import { useState } from "react";

import ImageUpload from "@/components/common/ImageUpload";
import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";
import type { MappingNode, NodeMetadata } from "@/components/map/map-types";
import {
  getNodeSplitterOptions,
  getNodeTypeLabel,
} from "@/components/map/node-form-utils";

const FIBER_CORE_COLORS = [
  { value: "Biru", label: "Biru / Blue", color: "#2563eb" },
  { value: "Orange", label: "Orange", color: "#f97316" },
  { value: "Hijau", label: "Hijau / Green", color: "#22c55e" },
  { value: "Coklat", label: "Coklat / Brown", color: "#92400e" },
  { value: "Abu-abu", label: "Abu-abu / Slate", color: "#6b7280" },
  { value: "Putih", label: "Putih / White", color: "#ffffff", border: true },
  { value: "Merah", label: "Merah / Red", color: "#ef4444" },
  { value: "Hitam", label: "Hitam / Black", color: "#000000" },
  { value: "Kuning", label: "Kuning / Yellow", color: "#eab308" },
  { value: "Ungu", label: "Ungu / Violet", color: "#a855f7" },
  { value: "Pink", label: "Pink / Rose", color: "#ec4899" },
  { value: "Tosca", label: "Tosca / Aqua", color: "#14b8a6" },
];

interface NodeFormModalProps {
  isOpen: boolean;
  nodeType: string;
  data: Partial<MappingNode>;
  isEditing: boolean;
  allowManualCoordinates?: boolean;
  onClose: () => void;
  onChange: (data: Partial<MappingNode>) => void;
  onSave: () => void;
}

export function NodeFormModal({
  isOpen,
  nodeType,
  data,
  isEditing,
  allowManualCoordinates = false,
  onClose,
  onChange,
  onSave,
}: NodeFormModalProps) {
  const [ontIdentifierType, setOntIdentifierType] = useState<
    "pppoe" | "serial"
  >("pppoe");

  if (!isOpen) return null;

  const inputClass =
    "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";
  const inputReadonlyClass =
    "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400";
  const labelClass =
    "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  const odcSplitterOptions = getNodeSplitterOptions("odc");
  const odpSplitterOptions = getNodeSplitterOptions("odp");
  const coreColorOptions = FIBER_CORE_COLORS.map((color) => ({
    value: color.value,
    label: color.label,
  }));

  const isServerOrOlt = nodeType === "server" || nodeType === "olt";
  const isOdc = nodeType === "odc";
  const isOdp = nodeType === "odp";
  const isOnt = nodeType === "ont";
  const isPole = nodeType === "pole";
  const isJoinbox = nodeType === "joinbox";

  const handlePhotoUpdate = (urls: string[]) => {
    const validUrls = urls.filter(
      (url) => url && typeof url === "string" && url.trim() !== "",
    );
    const photo = validUrls.length > 0 ? validUrls[0] : null;
    onChange({ ...data, photo });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditing
          ? `Edit ${getNodeTypeLabel(nodeType)}`
          : `Add New ${getNodeTypeLabel(nodeType)}`
      }
      size="lg"
    >
      <div className="space-y-4">
        {isServerOrOlt && (
          <>
            <div>
              <label className={labelClass}>Server Name *</label>
              <input
                type="text"
                value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="e.g., OLT-JAKARTA-01"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.latitude || ""
                      : data.latitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            latitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.longitude || ""
                      : data.longitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            longitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes..."
                className={inputClass}
              />
            </div>
            {!allowManualCoordinates && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <svg
                  className="w-5 h-5 text-blue-500 shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  The coordinates are automatically set from the marker position
                  on the map.
                </p>
              </div>
            )}
            <div className="mt-4">
              <ImageUpload
                label="Foto Server/OLT"
                value={
                  data.photo && typeof data.photo === "string"
                    ? [data.photo]
                    : []
                }
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="server-photos"
              />
            </div>
          </>
        )}

        {isOdc && (
          <>
            <div>
              <label className={labelClass}>ODC Name *</label>
              <input
                type="text"
                value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="e.g., ODC-JAKARTA-01"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Splitter Type *</label>
              <select
                value={data.splitter || "1:8"}
                onChange={(e) =>
                  onChange({ ...data, splitter: e.target.value })
                }
                className={inputClass}
              >
                {odcSplitterOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.latitude || ""
                      : data.latitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            latitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.longitude || ""
                      : data.longitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            longitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes..."
                className={inputClass}
              />
            </div>
            {!allowManualCoordinates && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <svg
                  className="w-5 h-5 text-blue-500 shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  The coordinates are automatically set from the marker position
                  on the map.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className={labelClass}>Input Redaman (dBm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={data.attenuationIn || ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      attenuationIn: parseFloat(e.target.value),
                    })
                  }
                  placeholder="e.g. -18.5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Output Redaman (dBm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={data.attenuationOut || ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      attenuationOut: parseFloat(e.target.value),
                    })
                  }
                  placeholder="e.g. -19.2"
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Warna Core Input</label>
                <Select
                  options={coreColorOptions}
                  value={data.inputCoreColor || ""}
                  onChange={(val) => onChange({ ...data, inputCoreColor: val })}
                  placeholder="Pilih Warna Core"
                />
              </div>
            </div>
            <div className="mt-4">
              <ImageUpload
                label="Foto ODC"
                value={
                  data.photo && typeof data.photo === "string"
                    ? [data.photo]
                    : []
                }
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="odc-photos"
              />
            </div>
          </>
        )}

        {isOdp && (
          <>
            <div>
              <label className={labelClass}>ODP Name *</label>
              <input
                type="text"
                value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="e.g., ODP-JAKARTA-01"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Splitter Type *</label>
              <select
                value={data.splitter || "1:8"}
                onChange={(e) =>
                  onChange({ ...data, splitter: e.target.value })
                }
                className={inputClass}
              >
                {odpSplitterOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.latitude || ""
                      : data.latitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            latitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.longitude || ""
                      : data.longitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            longitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes..."
                className={inputClass}
              />
            </div>
            {!allowManualCoordinates && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <svg
                  className="w-5 h-5 text-blue-500 shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  The coordinates are automatically set from the marker position
                  on the map.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className={labelClass}>Input Redaman (dBm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={data.attenuationIn || ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      attenuationIn: parseFloat(e.target.value),
                    })
                  }
                  placeholder="e.g. -18.5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Output Redaman (dBm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={data.attenuationOut || ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      attenuationOut: parseFloat(e.target.value),
                    })
                  }
                  placeholder="e.g. -19.2"
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Warna Core Input</label>
                <Select
                  options={coreColorOptions}
                  value={data.inputCoreColor || ""}
                  onChange={(val) => onChange({ ...data, inputCoreColor: val })}
                  placeholder="Pilih Warna Core"
                />
              </div>
            </div>
            <div className="mt-4">
              <ImageUpload
                label="Foto ODP"
                value={
                  data.photo && typeof data.photo === "string"
                    ? [data.photo]
                    : []
                }
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="odp-photos"
              />
            </div>
          </>
        )}

        {isOnt && (
          <>
            <div>
              <label className={labelClass}>Identifier Type</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={
                    ontIdentifierType === "pppoe" ? "default" : "secondary"
                  }
                  onClick={() => setOntIdentifierType("pppoe")}
                  className="flex-1"
                >
                  PPPoE
                </Button>
                <Button
                  type="button"
                  variant={
                    ontIdentifierType === "serial" ? "default" : "secondary"
                  }
                  onClick={() => setOntIdentifierType("serial")}
                  className="flex-1"
                >
                  Serial Number
                </Button>
              </div>
            </div>
            {ontIdentifierType === "pppoe" ? (
              <div>
                <label className={labelClass}>PPPoE Name *</label>
                <input
                  type="text"
                  value={data.pppoe || ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      pppoe: e.target.value,
                      name: e.target.value,
                    })
                  }
                  placeholder="Search PPPoE..."
                  className={inputClass}
                />
              </div>
            ) : (
              <div>
                <label className={labelClass}>Serial Number *</label>
                <input
                  type="text"
                  value={data.serialNumber || ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      serialNumber: e.target.value,
                      name: e.target.value,
                    })
                  }
                  placeholder="Enter Serial Number..."
                  className={inputClass}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.latitude || ""
                      : data.latitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            latitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.longitude || ""
                      : data.longitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            longitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes (optional)"
                className={inputClass}
              />
            </div>
            <div className="mt-4">
              <ImageUpload
                label="Foto ONT"
                value={
                  data.photo && typeof data.photo === "string"
                    ? [data.photo]
                    : []
                }
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="ont-photos"
              />
            </div>
          </>
        )}

        {isPole && (
          <>
            <div>
              <label className={labelClass}>Pole Name *</label>
              <input
                type="text"
                value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="e.g., POLE-001"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Pole Size</label>
                <select
                  value={data.metadata?.poleSize || "7m"}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      metadata: {
                        ...((data.metadata as NodeMetadata) || {}),
                        poleSize: e.target.value,
                      },
                    })
                  }
                  className={inputClass}
                >
                  <option value="6m">6m</option>
                  <option value="7m">7m</option>
                  <option value="9m">9m</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Cable Slack</label>
                <div className="flex items-center h-[42px]">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.metadata?.hasSlack || false}
                      onChange={(e) =>
                        onChange({
                          ...data,
                          metadata: {
                            ...((data.metadata as NodeMetadata) || {}),
                            hasSlack: e.target.checked,
                          },
                        })
                      }
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Ada Slack
                    </span>
                  </label>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.latitude || ""
                      : data.latitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            latitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.longitude || ""
                      : data.longitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            longitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes (optional)"
                className={inputClass}
              />
            </div>
            <div className="mt-4">
              <ImageUpload
                label="Foto Pole"
                value={
                  data.photo && typeof data.photo === "string"
                    ? [data.photo]
                    : []
                }
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="pole-photos"
              />
            </div>
          </>
        )}

        {isJoinbox && (
          <>
            <div>
              <label className={labelClass}>Joinbox Name *</label>
              <input
                type="text"
                value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="e.g., JB-001"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Capacity (Cores)</label>
                <select
                  value={data.capacity || 24}
                  onChange={(e) =>
                    onChange({ ...data, capacity: parseInt(e.target.value) })
                  }
                  className={inputClass}
                >
                  <option value={2}>2 Core</option>
                  <option value={4}>4 Core</option>
                  <option value={6}>6 Core</option>
                  <option value={12}>12 Core</option>
                  <option value={24}>24 Core</option>
                  <option value={48}>48 Core</option>
                  <option value={96}>96 Core</option>
                  <option value={144}>144 Core</option>
                  <option value={288}>288 Core</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Closure Type</label>
                <select
                  value={data.metadata?.closureType || "dome"}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      metadata: {
                        ...((data.metadata as NodeMetadata) || {}),
                        closureType: e.target.value,
                      },
                    })
                  }
                  className={inputClass}
                >
                  <option value="dome">Dome (Vertical)</option>
                  <option value="inline">Inline (Horizontal)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Latitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.latitude || ""
                      : data.latitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            latitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "-6.xxxxx" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input
                  type={allowManualCoordinates ? "number" : "text"}
                  step="any"
                  value={
                    allowManualCoordinates
                      ? data.longitude || ""
                      : data.longitude?.toFixed(6) || ""
                  }
                  readOnly={!allowManualCoordinates}
                  onChange={
                    allowManualCoordinates
                      ? (e) =>
                          onChange({
                            ...data,
                            longitude: parseFloat(e.target.value),
                          })
                      : undefined
                  }
                  className={
                    allowManualCoordinates ? inputClass : inputReadonlyClass
                  }
                  placeholder={allowManualCoordinates ? "106.xxxxx" : ""}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => onChange({ ...data, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes (optional)"
                className={inputClass}
              />
            </div>
            <div className="mt-4">
              <ImageUpload
                label="Foto Joinbox"
                value={
                  data.photo && typeof data.photo === "string"
                    ? [data.photo]
                    : []
                }
                onChange={handlePhotoUpdate}
                maxFiles={1}
                folder="joinbox-photos"
              />
            </div>
          </>
        )}
      </div>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSave}>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          {isEditing
            ? "Save Changes"
            : isOnt
              ? "Save ONT"
              : isPole
                ? "Save Pole"
                : isJoinbox
                  ? "Save Joinbox"
                  : "Add Node"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
