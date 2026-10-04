"use client";

import { useState, type FormEvent } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { clientLogger } from "@/lib/client-logger";
import { AffectedAreaPicker } from "./AffectedAreaPicker";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_HINT,
  INCIDENT_SEVERITY_LABEL,
  type IncidentSeverity,
} from "./incident-format";

/** Modal pencatatan insiden baru; update awal "Investigasi" dibuat server. */

const INCIDENTS_URL = "/api/admin/incidents";
const DEFAULT_SEVERITY: IncidentSeverity = "MAJOR";
const FAILURE_MESSAGE = "Gagal membuat insiden";
const INPUT_CLASS =
  "w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white";
const LABEL_CLASS = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

/** Kirim insiden baru; null bila berhasil, atau pesan galat untuk ditampilkan. */
async function submitIncident(payload: {
  title: string;
  description: string;
  severity: IncidentSeverity;
  affectedAreas: string[];
  isPublic: boolean;
}): Promise<string | null> {
  try {
    const response = await fetch(INCIDENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) return null;

    const body = (await response.json().catch(() => ({}))) as { error?: unknown };
    return typeof body.error === "string" ? body.error : FAILURE_MESSAGE;
  } catch (error) {
    clientLogger.error("[Incident] gagal membuat insiden:", error);
    return "Terjadi kesalahan jaringan";
  }
}

export function CreateIncidentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>(DEFAULT_SEVERITY);
  const [areas, setAreas] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    const errorMessage = await submitIncident({
      title: title.trim(),
      description: description.trim(),
      severity,
      affectedAreas: areas,
      isPublic,
    });
    setIsSaving(false);

    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }
    toast.success("Insiden berhasil dibuat");
    onCreated();
  };

  return (
    <Modal isOpen onClose={onClose} title="Catat insiden baru" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="incident-title" className={LABEL_CLASS}>
            Judul <span className="text-red-500">*</span>
          </label>
          <input
            id="incident-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            autoFocus
            placeholder="Gangguan koneksi area Selatan"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="incident-description" className={LABEL_CLASS}>
            Deskripsi awal <span className="text-red-500">*</span>
          </label>
          <textarea
            id="incident-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={3}
            placeholder="Apa yang terjadi, dampak, dan langkah awal yang sedang dilakukan..."
            className={INPUT_CLASS}
          />
        </div>

        <fieldset>
          <legend className={LABEL_CLASS}>Tingkat gangguan</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {INCIDENT_SEVERITIES.map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${
                  severity === option
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <input
                  type="radio"
                  name="incident-severity"
                  checked={severity === option}
                  onChange={() => setSeverity(option)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900 dark:text-white">
                    {INCIDENT_SEVERITY_LABEL[option]}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {INCIDENT_SEVERITY_HINT[option]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={LABEL_CLASS}>Area terdampak</legend>
          <AffectedAreaPicker value={areas} onChange={setAreas} />
        </fieldset>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Tampilkan di halaman status publik
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              Pelanggan bisa melihat insiden ini beserta update-nya.
            </span>
          </span>
        </label>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Menyimpan..." : "Catat insiden"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
