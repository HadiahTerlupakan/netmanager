"use client"

import { AlertTriangle, RefreshCw, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'

type ImportResult = {
  database: string
  status: 'success' | 'skipped' | 'error'
  message: string
}

type ResetResponse = {
  success: boolean
  message: string
  results: ImportResult[]
}

type ResetDatabaseProps = {
  resetting: boolean
  resetResult: ResetResponse | null
  resetError: string | null
  databaseLabels: Record<string, string>
  setResetModalOpen: (open: boolean) => void
  setResetError: (error: string | null) => void
}

export function ResetDatabase({
  resetting,
  resetResult,
  resetError,
  databaseLabels,
  setResetModalOpen,
  setResetError
}: ResetDatabaseProps) {
  return (
    <Card className="border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <Trash2 className="w-5 h-5" />
          Reset Database (Danger Zone)
        </CardTitle>
        <p className="text-sm text-red-500/80 dark:text-red-400/80">
          Hapus semua data dan kembalikan struktur database ke kondisi kosong
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-800 dark:text-red-300 space-y-1">
            <p className="font-bold uppercase tracking-tight">Tindakan ini sangat berisiko dan tidak bisa dibatalkan.</p>
            <ul className="list-disc list-inside space-y-0.5 font-medium">
              <li>Semua data di 4 database akan dihapus permanen.</li>
              <li>Anda kemungkinan ter-logout karena data user ikut terhapus.</li>
              <li>Hanya jalankan jika Anda sudah memiliki file backup terbaru.</li>
            </ul>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => {
            setResetError(null)
            setResetModalOpen(true)
          }}
          disabled={resetting}
          variant="destructive"
          className="w-full h-12 gap-2 shadow-lg shadow-red-500/20"
        >
          {resetting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Sedang Reset Database...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              Reset Semua Database Sekarang
            </>
          )}
        </Button>

        {resetError && (
          <div className="flex items-start gap-2 p-3 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-red-800 dark:text-red-200">{resetError}</p>
          </div>
        )}

        {resetResult && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${
              resetResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              {resetResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{resetResult.message}</p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {resetResult.results.map((r) => (
                <div
                  key={`reset-${r.database}`}
                  className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800"
                >
                  {r.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : r.status === 'skipped' ? (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {databaseLabels[r.database] || r.database}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
