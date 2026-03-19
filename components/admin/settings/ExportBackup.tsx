"use client"

import { Download, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'

type ExportBackupProps = {
  exporting: boolean
  exportSuccess: boolean
  exportError: string | null
  handleExport: () => void
  databaseLabels: Record<string, string>
}

export function ExportBackup({
  exporting,
  exportSuccess,
  exportError,
  handleExport,
  databaseLabels
}: ExportBackupProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5 text-indigo-500" />
          Export Backup
        </CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Download semua database sekaligus (NetManager, RADIUS, Billing, Mitra)
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Database yang akan di-backup:
          </p>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(databaseLabels).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                <code className="ml-auto text-[10px] font-mono text-gray-400 uppercase">{key}</code>
              </div>
            ))}
          </div>
        </div>

        <Button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          variant="default"
          className="w-full h-12 gap-2"
        >
          {exporting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Sedang Membuat Backup...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download Backup
            </>
          )}
        </Button>

        {exportSuccess && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-in fade-in slide-in-from-top-1">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            <p className="text-sm font-medium text-green-800 dark:text-green-400">
              Backup berhasil di-download!
            </p>
          </div>
        )}

        {exportError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-800 dark:text-red-400">{exportError}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
