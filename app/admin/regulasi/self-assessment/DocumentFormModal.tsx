"use client";

import { useState, type FormEvent } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import PageLoader from "@/components/ui/PageLoader";
import { clientLogger } from "@/lib/client-logger";
import { useApi } from "@/lib/hooks/useApi";
import type { LicenseScheme } from "@/modules/regulatory/client";
import {
  PARAMETER_ROWS,
  PROFILE_FIELDS,
  type DocumentForm,
  type OperatorProfile,
  type YearlyDocumentInput,
} from "./document-form-types";
import { formatRatio } from "./self-assessment-format";

/**
 * Formulir dokumen Word Komdigi: profil penyelenggara (tersimpan untuk tahun
 * berikutnya), capaian parameter yang belum dihitung sistem, dan link dokumen
 * pendukung. "Simpan & unduh" menyimpan lalu mengunduh .docx terisi.
 */

const BASE_URL = "/api/admin/regulatory/self-assessment";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white";
const LABEL_CLASS =
  "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";

/** Picu unduhan berkas dari URL (sesi ikut terkirim karena satu origin). */
function startDownload(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function saveDocumentForm(
  skema: LicenseScheme,
  year: number,
  body: { profile: OperatorProfile; yearly: YearlyDocumentInput },
): Promise<string | null> {
  try {
    const response = await fetch(
      `${BASE_URL}/document-form?skema=${skema}&year=${year}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (response.ok) return null;
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: Record<string, string>;
    };
    const [detail] = Object.values(payload.details ?? {});
    return [payload.error ?? "Gagal menyimpan isian dokumen", detail]
      .filter(Boolean)
      .join(": ");
  } catch (error) {
    clientLogger.error("[Regulasi] gagal menyimpan isian dokumen:", error);
    return "Terjadi kesalahan jaringan";
  }
}

function DocumentFormFields({
  initial,
  skema,
  year,
  onClose,
}: {
  initial: DocumentForm;
  skema: LicenseScheme;
  year: number;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<OperatorProfile>(initial.profile);
  const [manual, setManual] = useState(initial.yearly.manualAchievements);
  const [links, setLinks] = useState(initial.yearly.supportingLinks);
  const [isSaving, setIsSaving] = useState(false);

  const save = async (shouldDownload: boolean) => {
    setIsSaving(true);
    const errorMessage = await saveDocumentForm(skema, year, {
      profile,
      yearly: { manualAchievements: manual, supportingLinks: links },
    });
    setIsSaving(false);
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }
    toast.success("Isian dokumen disimpan");
    if (shouldDownload) startDownload(`${BASE_URL}/document?year=${year}`);
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          Profil penyelenggara
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PROFILE_FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={`profile-${field.key}`} className={LABEL_CLASS}>
                {field.label}
              </label>
              <input
                id={`profile-${field.key}`}
                type={field.type ?? "text"}
                value={profile[field.key]}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
                placeholder={field.placeholder}
                className={INPUT_CLASS}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Profil disimpan dan dipakai lagi untuk tahun berikutnya.
        </p>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
          Capaian tahun {year}
        </h3>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Pasang baru & pemulihan dihitung otomatis. Parameter lain belum
          direkam sistem — isi persennya dari pengukuran Anda (kosongkan bila
          belum ada; tercetak “-”).
        </p>
        <div className="space-y-3">
          {PARAMETER_ROWS.map((row) => {
            const { source } = row;
            return (
              <div
                key={row.linkKey}
                className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[1fr_8rem_1fr] sm:items-center dark:border-gray-700"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {row.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    Tolok ukur {row.standard}
                  </p>
                </div>
                {source.kind === "computed" ? (
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatRatio(initial.computed[source.key])}
                    <span className="block text-xs font-normal text-gray-500">
                      otomatis
                    </span>
                  </div>
                ) : (
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Capaian ${row.label} (%)`}
                    value={manual[source.key] ?? ""}
                    onChange={(event) =>
                      setManual((current) => ({
                        ...current,
                        [source.key]: event.target.value,
                      }))
                    }
                    placeholder="mis. 99,5"
                    className={INPUT_CLASS}
                  />
                )}
                <input
                  type="url"
                  aria-label={`Link dokumen pendukung ${row.label}`}
                  value={links[row.linkKey] ?? ""}
                  onChange={(event) =>
                    setLinks((current) => ({
                      ...current,
                      [row.linkKey]: event.target.value,
                    }))
                  }
                  placeholder="Link dokumen pendukung (opsional)"
                  className={INPUT_CLASS}
                />
              </div>
            );
          })}
        </div>
      </section>

      <ModalFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isSaving}
        >
          Batal
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void save(false)}
          disabled={isSaving}
        >
          Simpan saja
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Menyimpan..." : "Simpan & unduh Word"}
        </Button>
      </ModalFooter>
    </form>
  );
}

/** Modal formulir dokumen Word untuk tahun laporan terpilih. */
export function DocumentFormModal({
  skema,
  year,
  onClose,
}: {
  skema: LicenseScheme;
  year: number;
  onClose: () => void;
}) {
  const {
    data: form,
    isLoading,
    error,
  } = useApi<DocumentForm>(
    `${BASE_URL}/document-form?skema=${skema}&year=${year}`,
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Dokumen Word Komdigi ${year}`}
      size="3xl"
    >
      {isLoading && <PageLoader />}
      {error && !isLoading && (
        <p className="text-sm text-red-600">
          Gagal memuat isian dokumen. Coba lagi.
        </p>
      )}
      {form && !isLoading && (
        <DocumentFormFields
          initial={form}
          skema={skema}
          year={year}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
