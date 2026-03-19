"use client"

import { Upload, CheckCircle2, XCircle, AlertTriangle, FileUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'

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

type ImportBackupProps = {
  importing: boolean
  importResult: ImportResponse | null
  importError: string | null
  selectedFile: File | null
  fileInputRef: React.RefObject<HTMLInputElement>
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleImport: () => void
  resetImport: () => void
  databaseLabels: Record<string, string>
}

export function ImportBackup({
  importing,
  importResult,
  importError,
  selectedFile,
  fileInputRef,
  handleFileChange,
  handleImport,
  resetImport,
  databaseLabels
}: ImportBackupProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-amber-500" />
          Import Backup
        </CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Restore dari file backup yang sudah di-download sebelumnya
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
            Peringatan: Data yang sudah ada <strong>tidak akan dihapus</strong>. Hanya data baru yang akan ditambahkan ke database.
          </p>
        </div>

        {!importResult && !importing && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".tar.gz,.tgz,application/gzip,application/x-gzip,application/tar+gzip"
              onChange={handleFileChange}
              className="hidden"
              id="backup-file-input"
            />
            <div
              className="relative w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 text-center hover:border-indigo-400 dark:hover:border-indigo-500 transition-all cursor-pointer bg-gray-50/50 dark:bg-gray-800/30 group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="bg-white dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                <FileUp className="w-8 h-8 text-indigo-500" />
              </div>
              {selectedFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-xs mx-auto">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500 font-medium">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Klik atau seret file backup ke sini
                  </p>
                  <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">Format: .tar.gz</p>
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={handleImport}
              disabled={!selectedFile || importing}
              variant="warning"
              className="w-full h-12 gap-2"
            >
              <Upload className="w-4 h-4" />
              Mulai Import Data
            </Button>

            {importError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-800 dark:text-red-400">{importError}</p>
              </div>
            )}
          </div>
        )}

        {importing && (
          <div className="flex flex-col items-center justify-center py-10 px-4 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-center animate-in fade-in zoom-in duration-300">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full border-4 border-amber-100 dark:border-amber-900/30 border-t-amber-500 animate-spin" />
              <Upload className="w-8 h-8 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Mengimport Database...</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-8 mx-auto leading-relaxed">
              Proses ini menyalin data backup ke dalam 4 database secara paralel. Harap tunggu dan jangan tutup halaman ini.
            </p>
            <div className="w-full max-w-xs space-y-4">
              <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-linear-to-r from-amber-400 to-orange-500 rounded-full w-full animate-progress-indeterminate" />
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  Processing
                </span>
                <span>Restoring Tables</span>
              </div>
            </div>
          </div>
        )}

        {importResult && !importing && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
              importResult.success
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50'
                : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50'
            }`}>
              {importResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <p className={`text-sm font-bold leading-relaxed ${
                importResult.success ? 'text-green-800 dark:text-green-400' : 'text-amber-800 dark:text-amber-400'
              }`}>
                {importResult.message}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {importResult.results.map((r) => (
                <div
                  key={r.database}
                  className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:border-gray-200 dark:hover:border-gray-700"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    r.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 
                    r.status === 'skipped' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {r.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : r.status === 'skipped' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {databaseLabels[r.database] || r.database}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              onClick={resetImport}
              variant="outline"
              className="w-full font-bold h-11"
            >
              Import File Lain
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
