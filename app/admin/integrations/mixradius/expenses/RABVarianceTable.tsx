'use client'

import { formatCurrency } from '@/lib/utils'

import type { RABRevisionVarianceItem } from './rabRevisionTypes'

interface RABVarianceTableProps {
  items: RABRevisionVarianceItem[]
}

const LABEL_STYLES: Record<RABRevisionVarianceItem['varianceLabel'], string> = {
  UNTUNG: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300',
  RUGI: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
  SESUAI: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
}

export default function RABVarianceTable({ items }: RABVarianceTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
        Belum ada item revisi final yang bisa dibandingkan dengan realisasi.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Revisi Final</th>
              <th className="px-4 py-3">Realisasi</th>
              <th className="px-4 py-3">Selisih</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
            {items.map((item) => (
              <tr key={item.revisionItemId} className="align-top">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{item.name}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatCurrency(Number(item.finalTotal))}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatCurrency(Number(item.actualTotal))}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatCurrency(Number(item.variance))}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${LABEL_STYLES[item.varianceLabel]}`}>
                    {item.varianceLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
