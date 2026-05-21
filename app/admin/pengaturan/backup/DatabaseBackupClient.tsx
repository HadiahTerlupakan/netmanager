"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { ExportBackup } from "@/components/admin/settings/ExportBackup";
import { ImportBackup } from "@/components/admin/settings/ImportBackup";
import { ResetDatabase } from "@/components/admin/settings/ResetDatabase";
import { HiOutlineRectangleStack } from "react-icons/hi2";

type ImportResult = {
  database: string;
  status: "success" | "skipped" | "error";
  message: string;
};

type ImportResponse = {
  success: boolean;
  message: string;
  results: ImportResult[];
};

type ResetResponse = {
  success: boolean;
  message: string;
  results: ImportResult[];
};

const RESET_CONFIRMATION_TEXT = "RESET DATABASE";

const DATABASE_LABELS: Record<string, string> = {
  netmanager: "NetManager (Utama)",
  radius: "RADIUS",
  billing: "Billing",
  mitra: "Mitra",
};

export function ClientComponent({
  canResetDatabase,
}: {
  canResetDatabase: boolean;
}) {
  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<ResetResponse | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmationInput, setResetConfirmationInput] = useState("");

  // COA Seed state
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{
    status: string;
    message: string;
  } | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  const handleSeedCoa = async (force = false) => {
    if (
      force &&
      !confirm(
        "Reset akan menghapus semua akun sistem dan membuat ulang. Lanjutkan?",
      )
    )
      return;
    setSeeding(true);
    setSeedResult(null);
    setSeedError(null);
    try {
      const res = await fetch("/api/admin/accounting/coa/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Gagal seed COA");
      }
      setSeedResult(data.data);
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSeeding(false);
    }
  };

  // ─── EXPORT ──────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      const res = await fetch("/api/settings/backup/export");

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error || `HTTP ${res.status}: Gagal export database`,
        );
      }

      // Ambil nama file dari header Content-Disposition
      const disposition = res.headers.get("Content-Disposition") || "";
      const fileNameMatch = disposition.match(/filename="?([^"]+)"?/);
      const fileName =
        fileNameMatch?.[1] || `netmanager_backup_${formatTimestamp()}.tar.gz`;

      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Terjadi kesalahan saat export",
      );
    } finally {
      setExporting(false);
    }
  };

  // ─── IMPORT ──────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setImportResult(null);
    setImportError(null);
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/settings/backup/import", {
        method: "POST",
        body: formData,
      });

      const data: ImportResponse = await res.json();

      if (!res.ok) {
        throw new Error(
          (data as unknown as { error?: string })?.error ||
            `HTTP ${res.status}: Gagal import`,
        );
      }

      setImportResult(data);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Terjadi kesalahan saat import",
      );
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setSelectedFile(null);
    setImportResult(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── RESET ───────────────────────────────────────────────────────────
  const handleResetDatabase = async () => {
    if (resetConfirmationInput.trim() !== RESET_CONFIRMATION_TEXT) {
      setResetError(
        `Konfirmasi tidak cocok. Harus tepat: ${RESET_CONFIRMATION_TEXT}`,
      );
      return;
    }

    setResetting(true);
    setResetError(null);
    setResetResult(null);

    try {
      const res = await fetch("/api/settings/backup/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmationText: resetConfirmationInput.trim(),
        }),
      });

      const data: ResetResponse = await res.json();

      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ||
            `HTTP ${res.status}: Gagal reset database`,
        );
      }

      setResetResult(data);
      setResetModalOpen(false);
      setResetConfirmationInput("");
    } catch (err) {
      setResetError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat reset database",
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="mb-4 text-center md:text-left">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Backup & Pemulihan
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Export, import, dan kelola integritas database aplikasi Anda
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExportBackup
          exporting={exporting}
          exportSuccess={exportSuccess}
          exportError={exportError}
          handleExport={handleExport}
          databaseLabels={DATABASE_LABELS}
        />

        <ImportBackup
          importing={importing}
          importResult={importResult}
          importError={importError}
          selectedFile={selectedFile}
          fileInputRef={fileInputRef}
          handleFileChange={handleFileChange}
          handleImport={handleImport}
          resetImport={resetImport}
          databaseLabels={DATABASE_LABELS}
        />
      </div>

      {/* Inisialisasi Akuntansi */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg shrink-0">
            <HiOutlineRectangleStack className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Inisialisasi Akuntansi
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Buat Chart of Accounts (COA) standar ISP secara otomatis. Termasuk
              akun Aset, Kewajiban, Ekuitas, Pendapatan, dan Beban dengan
              klasifikasi CAPEX/OPEX.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => handleSeedCoa(false)} disabled={seeding}>
                {seeding ? "Memproses..." : "Buat Akun Standar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSeedCoa(true)}
                disabled={seeding}
              >
                Reset & Seed Ulang
              </Button>
            </div>
            {seedResult && (
              <div
                className={`mt-3 text-sm font-medium ${seedResult.status === "exists" ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400"}`}
              >
                {seedResult.message}
              </div>
            )}
            {seedError && (
              <div className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                {seedError}
              </div>
            )}
          </div>
        </div>
      </div>

      {canResetDatabase && (
        <ResetDatabase
          resetting={resetting}
          resetResult={resetResult}
          resetError={resetError}
          databaseLabels={DATABASE_LABELS}
          setResetModalOpen={setResetModalOpen}
          setResetError={setResetError}
        />
      )}

      <Modal
        isOpen={resetModalOpen}
        onClose={() => {
          if (resetting) return;
          setResetModalOpen(false);
        }}
        title="Konfirmasi Reset Database"
        description="Tindakan ini menghapus semua data secara permanen dari NetManager, RADIUS, Billing, dan Mitra."
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-800 dark:text-red-300">
            Ketik{" "}
            <code className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900">
              {RESET_CONFIRMATION_TEXT}
            </code>{" "}
            untuk melanjutkan.
          </div>
          <div>
            <label
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              htmlFor="reset-confirmation-input"
            >
              Konfirmasi Reset
            </label>
            <input
              id="reset-confirmation-input"
              type="text"
              value={resetConfirmationInput}
              onChange={(e) => setResetConfirmationInput(e.target.value)}
              placeholder={`Ketik ${RESET_CONFIRMATION_TEXT}`}
              disabled={resetting}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setResetModalOpen(false);
              setResetConfirmationInput("");
            }}
            disabled={resetting}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleResetDatabase}
            loading={resetting}
            disabled={resetConfirmationInput.trim() !== RESET_CONFIRMATION_TEXT}
          >
            Reset Sekarang
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function formatTimestamp() {
  const now = new Date();
  return now
    .toISOString()
    .replace(/[-:T]/g, "")
    .replace(/\..+/, "")
    .slice(0, 15)
    .replace(/(\d{8})(\d{6})/, "$1_$2");
}
