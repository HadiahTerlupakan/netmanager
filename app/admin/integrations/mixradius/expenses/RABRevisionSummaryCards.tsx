'use client'

import { formatCurrency } from '@/lib/utils'

import type { RABRevisionVarianceLabel } from './rabRevisionTypes'

interface RABRevisionSummaryCardsProps {
  summary: {
    original: string
    final: string
    actual: string
    variance: string
    label: RABRevisionVarianceLabel
    unmappedRealization?: string
  }
}

const LABEL_STYLES: Record<RABRevisionVarianceLabel, string> = {
  UNTUNG: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300',
  RUGI: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
  SESUAI: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
}

export default function RABRevisionSummaryCards({ summary }: RABRevisionSummaryCardsProps) {
  const cards = [
    {
      title: 'Budget Awal',
      value: summary.original,
      tone: 'from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-950',
    },
    {
      title: 'Revisi Final',
      value: summary.final,
      tone: 'from-sky-100 to-cyan-50 dark:from-sky-950/70 dark:to-cyan-950/40',
    },
    {
      title: 'Realisasi',
      value: summary.actual,
      tone: 'from-amber-100 to-orange-50 dark:from-amber-950/60 dark:to-orange-950/40',
    },
    {
      title: 'Selisih',
      value: summary.variance,
      tone: 'from-emerald-100 to-lime-50 dark:from-emerald-950/60 dark:to-lime-950/30',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`rounded-xl border border-slate-200 bg-gradient-to-br ${card.tone} p-4 shadow-sm dark:border-slate-700`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              {card.title}
            </p>
            <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100 md:text-xl">
              {formatCurrency(Number(card.value))}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Status Variance
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Selisih dihitung dari baseline revisi final terhadap realisasi pengeluaran yang sudah tercatat.
          </p>
        </div>
        <div className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold ${LABEL_STYLES[summary.label]}`}>
          {summary.label}
        </div>
      </div>

      {summary.unmappedRealization && Number(summary.unmappedRealization) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          Realisasi tanpa mapping item: {formatCurrency(Number(summary.unmappedRealization))}
        </div>
      )}
    </div>
  )
}
