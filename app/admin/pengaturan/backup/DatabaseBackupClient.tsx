'use client'

import { useRef, useState } from 'react'
import {
    HiArrowPath,
    HiCheckCircle,
    HiCloudArrowDown,
    HiCloudArrowUp,
    HiExclamationCircle,
    HiExclamationTriangle,
    HiInformationCircle,
    HiXCircle,
} from 'react-icons/hi2'
import { Button } from '@/components/ui/Button'
import { Modal, ModalFooter } from '@/components/ui/Modal'

type ImportResult = {
    database: string
    status: 'success' | 'skipped' | 'error'
    message: string
}

type ImportResponse = {
    success: boolean
    message: string
    results: ImportResult[]
}

type ResetResponse = {
    success: boolean
    message: string
    results: ImportResult[]
}

const RESET_CONFIRMATION_TEXT = 'RESET DATABASE'

const DATABASE_LABELS: Record<string, string> = {
    netmanager: 'NetManager (Utama)',
    radius: 'RADIUS',
    billing: 'Billing',
    mitra: 'Mitra',
}

export function ClientComponent({ canResetDatabase }: { canResetDatabase: boolean }) {
    // Export state
    const [exporting, setExporting] = useState(false)
    const [exportSuccess, setExportSuccess] = useState(false)
    const [exportError, setExportError] = useState<string | null>(null)

    // Import state
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<ImportResponse | null>(null)
    const [importError, setImportError] = useState<string | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [resetting, setResetting] = useState(false)
    const [resetResult, setResetResult] = useState<ResetResponse | null>(null)
    const [resetError, setResetError] = useState<string | null>(null)
    const [resetModalOpen, setResetModalOpen] = useState(false)
    const [resetConfirmationInput, setResetConfirmationInput] = useState('')

    // ─── EXPORT ──────────────────────────────────────────────────────────
    const handleExport = async () => {
        setExporting(true)
        setExportError(null)
        setExportSuccess(false)

        try {
            const res = await fetch('/api/settings/backup/export')

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data?.error || `HTTP ${res.status}: Gagal export database`)
            }

            // Ambil nama file dari header Content-Disposition
            const disposition = res.headers.get('Content-Disposition') || ''
            const fileNameMatch = disposition.match(/filename="?([^"]+)"?/)
            const fileName = fileNameMatch?.[1] || `netmanager_backup_${formatTimestamp()}.tar.gz`

            // Trigger download
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setExportSuccess(true)
            setTimeout(() => setExportSuccess(false), 5000)
        } catch (err) {
            setExportError(err instanceof Error ? err.message : 'Terjadi kesalahan saat export')
        } finally {
            setExporting(false)
        }
    }

    // ─── IMPORT ──────────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        setSelectedFile(file)
        setImportResult(null)
        setImportError(null)
    }

    const handleImport = async () => {
        if (!selectedFile) return

        setImporting(true)
        setImportResult(null)
        setImportError(null)

        try {
            const formData = new FormData()
            formData.append('file', selectedFile)

            const res = await fetch('/api/settings/backup/import', {
                method: 'POST',
                body: formData,
            })

            const data: ImportResponse = await res.json()

            if (!res.ok) {
                throw new Error((data as unknown as { error?: string })?.error || `HTTP ${res.status}: Gagal import`)
            }

            setImportResult(data)
        } catch (err) {
            setImportError(err instanceof Error ? err.message : 'Terjadi kesalahan saat import')
        } finally {
            setImporting(false)
        }
    }

    const resetImport = () => {
        setSelectedFile(null)
        setImportResult(null)
        setImportError(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleResetDatabase = async () => {
        if (resetConfirmationInput.trim() !== RESET_CONFIRMATION_TEXT) {
            setResetError(`Konfirmasi tidak cocok. Harus tepat: ${RESET_CONFIRMATION_TEXT}`)
            return
        }

        setResetting(true)
        setResetError(null)
        setResetResult(null)

        try {
            const res = await fetch('/api/settings/backup/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ confirmationText: resetConfirmationInput.trim() }),
            })

            const data: ResetResponse = await res.json()

            if (!res.ok) {
                throw new Error((data as { error?: string }).error || `HTTP ${res.status}: Gagal reset database`)
            }

            setResetResult(data)
            setResetModalOpen(false)
            setResetConfirmationInput('')
        } catch (err) {
            setResetError(err instanceof Error ? err.message : 'Terjadi kesalahan saat reset database')
        } finally {
            setResetting(false)
        }
    }

    return (
        <div className="w-full space-y-6">
            {/* Header */}
            <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Backup Database</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Export dan import semua database aplikasi (NetManager, RADIUS, Billing, Mitra)
                </p>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <HiInformationCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                    <p className="font-medium">Informasi Backup</p>
                    <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                        <li>Export akan menghasilkan satu file <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded">.tar.gz</code> berisi semua database</li>
                        <li>Import menggunakan file hasil export yang sama — tidak perlu extract manual</li>
                        <li>Data yang sudah ada <strong>tidak akan dihapus</strong> saat import, hanya data baru yang ditambahkan</li>
                    </ul>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ─── EXPORT SECTION ─── */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                            <HiCloudArrowDown className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Export Backup</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Download semua database sekaligus</p>
                        </div>
                    </div>

                    {/* Database list */}
                    <div className="space-y-2 mb-5">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Database yang akan di-backup:
                        </p>
                        {Object.entries(DATABASE_LABELS).map(([key, label]) => (
                            <div
                                key={key}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                            >
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                                <code className="ml-auto text-xs text-gray-400 dark:text-gray-500">{key}</code>
                            </div>
                        ))}
                    </div>

                    {/* Export Button */}
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:cursor-not-allowed"
                    >
                        {exporting ? (
                            <>
                                <HiArrowPath className="w-4 h-4 animate-spin" />
                                Sedang Membuat Backup...
                            </>
                        ) : (
                            <>
                                <HiCloudArrowDown className="w-4 h-4" />
                                Download Backup
                            </>
                        )}
                    </button>

                    {/* Export feedback */}
                    {exportSuccess && (
                        <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <HiCheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                            <p className="text-sm text-green-800 dark:text-green-400">
                                Backup berhasil di-download!
                            </p>
                        </div>
                    )}

                    {exportError && (
                        <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <HiXCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800 dark:text-red-400">{exportError}</p>
                        </div>
                    )}
                </div>

                {/* ─── IMPORT SECTION ─── */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                            <HiCloudArrowUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Import Backup</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Restore dari file backup yang sudah di-download</p>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-5">
                        <HiExclamationTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 dark:text-amber-400">
                            Data yang sudah ada <strong>tidak akan dihapus</strong>. Hanya data baru yang akan ditambahkan.
                        </p>
                    </div>

                    {/* File Upload Area */}
                    {!importResult && !importing && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".tar.gz,.tgz,application/gzip,application/x-gzip,application/tar+gzip"
                                onChange={handleFileChange}
                                className="hidden"
                                id="backup-file-input"
                            />
                            <button
                                type="button"
                                className="relative w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <HiCloudArrowUp className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                {selectedFile ? (
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate px-2">
                                            {selectedFile.name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Klik untuk pilih file backup
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Format: .tar.gz</p>
                                    </div>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleImport}
                                disabled={!selectedFile || importing}
                                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:cursor-not-allowed"
                            >
                                <HiCloudArrowUp className="w-4 h-4" />
                                Mulai Import
                            </button>

                            {importError && (
                                <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <HiXCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-800 dark:text-red-400">{importError}</p>
                                </div>
                            )}
                        </>
                    )}

                    {importing && (
                        <div className="flex flex-col items-center justify-center py-10 px-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-center animate-in fade-in zoom-in duration-300">
                            <HiArrowPath className="w-12 h-12 text-amber-500 animate-spin mb-4" />
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Mereset dan Mengimport Database...</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6 mx-auto leading-relaxed">
                                Proses ini menyedot file backup ke dalam 4 database secara paralel. Harap tunggu dan jangan tutup halaman ini.
                            </p>
                            <div className="w-full max-w-sm space-y-3">
                                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                                    <div className="h-full bg-amber-500 rounded-full w-full animate-pulse opacity-80"></div>
                                </div>
                                <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> Memproses...</span>
                                    <span>Menyalin tabel...</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {importResult && !importing && (
                        /* Import Results */
                        <div className="space-y-4">
                            {/* Summary */}
                            <div
                                className={`flex items-start gap-3 p-4 rounded-lg border ${importResult.success
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                                    }`}
                            >
                                {importResult.success ? (
                                    <HiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                ) : (
                                    <HiExclamationCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                )}
                                <p
                                    className={`text-sm font-medium ${importResult.success
                                        ? 'text-green-800 dark:text-green-400'
                                        : 'text-amber-800 dark:text-amber-400'
                                        }`}
                                >
                                    {importResult.message}
                                </p>
                            </div>

                            {/* Per-database results */}
                            <div className="space-y-2">
                                {importResult.results.map((r) => (
                                    <div
                                        key={r.database}
                                        className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                    >
                                        {r.status === 'success' ? (
                                            <HiCheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                                        ) : r.status === 'skipped' ? (
                                            <HiExclamationTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                                        ) : (
                                            <HiXCircle className="w-4 h-4 text-red-500 shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                {DATABASE_LABELS[r.database] || r.database}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.message}</p>
                                        </div>
                                        <span
                                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === 'success'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                                                : r.status === 'skipped'
                                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                                                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                                }`}
                                        >
                                            {r.status === 'success' ? 'Berhasil' : r.status === 'skipped' ? 'Dilewati' : 'Error'}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={resetImport}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            >
                                Import File Lain
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {canResetDatabase && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 bg-red-50 dark:bg-red-900/30 rounded-lg">
                            <HiExclamationTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Reset Database (Danger Zone)</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Hapus semua data dan kembalikan struktur database kosong</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-5">
                        <HiExclamationTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-red-800 dark:text-red-400 space-y-1">
                            <p className="font-semibold">Sangat berisiko dan tidak bisa di-undo.</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                <li>Semua data di 4 database akan dihapus permanen.</li>
                                <li>Anda kemungkinan ter-logout karena data user ikut terhapus.</li>
                                <li>Hanya jalankan jika Anda sudah memiliki file backup terbaru.</li>
                            </ul>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setResetError(null)
                            setResetModalOpen(true)
                        }}
                        disabled={resetting}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:cursor-not-allowed"
                    >
                        {resetting ? (
                            <>
                                <HiArrowPath className="w-4 h-4 animate-spin" />
                                Sedang Reset Database...
                            </>
                        ) : (
                            <>
                                <HiExclamationTriangle className="w-4 h-4" />
                                Reset Semua Database
                            </>
                        )}
                    </button>

                    {resetError && (
                        <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <HiXCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800 dark:text-red-400">{resetError}</p>
                        </div>
                    )}

                    {resetResult && (
                        <div className="mt-4 space-y-3">
                            <div
                                className={`flex items-start gap-2 p-3 rounded-lg border ${resetResult.success
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                                    }`}
                            >
                                {resetResult.success ? (
                                    <HiCheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                ) : (
                                    <HiExclamationCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                )}
                                <p className="text-sm text-gray-800 dark:text-gray-200">{resetResult.message}</p>
                            </div>

                            <div className="space-y-2">
                                {resetResult.results.map((r) => (
                                    <div
                                        key={`reset-${r.database}`}
                                        className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                    >
                                        {r.status === 'success' ? (
                                            <HiCheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                                        ) : r.status === 'skipped' ? (
                                            <HiExclamationTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                                        ) : (
                                            <HiXCircle className="w-4 h-4 text-red-500 shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                {DATABASE_LABELS[r.database] || r.database}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={resetModalOpen}
                onClose={() => {
                    if (resetting) return
                    setResetModalOpen(false)
                }}
                title="Konfirmasi Reset Database"
                description="Tindakan ini menghapus semua data secara permanen dari NetManager, RADIUS, Billing, dan Mitra."
                size="md"
            >
                <div className="space-y-4">
                    <div className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-800 dark:text-red-300">
                        Ketik <code className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900">{RESET_CONFIRMATION_TEXT}</code> untuk melanjutkan.
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" htmlFor="reset-confirmation-input">
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
                            setResetModalOpen(false)
                            setResetConfirmationInput('')
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
        </div >
    )
}

function formatTimestamp() {
    const now = new Date()
    return now
        .toISOString()
        .replace(/[-:T]/g, '')
        .replace(/\..+/, '')
        .slice(0, 15)
        .replace(/(\d{8})(\d{6})/, '$1_$2')
}
