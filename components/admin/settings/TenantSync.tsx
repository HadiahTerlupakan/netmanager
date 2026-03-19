"use client"

import { RefreshCw, Info, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'

type TenantSyncProps = {
  backfilling: boolean
  backfillResult: { success: boolean; message: string; log?: string } | null
  backfillError: string | null
  handleBackfill: () => void
}

export function TenantSync({
  backfilling,
  backfillResult,
  backfillError,
  handleBackfill
}: TenantSyncProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className={`w-5 h-5 text-blue-500 ${backfilling ? 'animate-spin' : ''}`} />
          Sinkronisasi Multi-Tenant
        </CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Jalankan jika ada data master/legacy yang tidak terhubung ke tenant apa pun setelah Import
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            Fitur ini akan mengecek seluruh data yang tidak memiliki <strong>ID Tenant</strong> dan menghubungkannya dengan tenant utama. Jalankan rutin <strong>satu kali setelah berhasil mengimport database legacy</strong> dari menu Backup.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleBackfill}
          disabled={backfilling}
          variant="default"
          className="w-full h-12 gap-2"
        >
          {backfilling ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Sedang Melakukan Sinkronisasi...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Sinkronisasi Data Multi-Tenant
            </>
          )}
        </Button>

        {backfillError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-400 font-medium">{backfillError}</p>
          </div>
        )}

        {backfillResult && (
          <div className="space-y-3">
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${
              backfillResult.success 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              {backfillResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <p className={`text-sm font-semibold ${
                backfillResult.success ? 'text-green-800 dark:text-green-400' : 'text-amber-800 dark:text-amber-400'
              }`}>
                {backfillResult.message}
              </p>
            </div>
            
            {backfillResult.log && (
              <div className="relative group">
                <div className="absolute -top-2 left-4 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-bold text-gray-500 uppercase tracking-widest border border-gray-200 dark:border-gray-700">
                  Execution Log
                </div>
                <pre className="w-full text-xs font-mono whitespace-pre-wrap text-green-900 dark:text-green-300 bg-gray-50 dark:bg-gray-900 p-5 pt-7 rounded-xl border border-gray-200 dark:border-gray-800 max-h-48 overflow-auto scrollbar-thin">
                  {backfillResult.log}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
