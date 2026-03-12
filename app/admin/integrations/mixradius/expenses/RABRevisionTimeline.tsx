'use client'

import { format } from 'date-fns'

import type { RABRevisionRecord } from './rabRevisionTypes'

interface RABRevisionTimelineProps {
  revisions: RABRevisionRecord[]
  finalApprovedRevisionId?: string | null
  canReview?: boolean
  isSubmittingRevisionId?: string | null
  onApprove?: (revision: RABRevisionRecord) => void
  onReject?: (revision: RABRevisionRecord) => void
}

const STATUS_STYLES: Record<string, string> = {
  APPROVED:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300',
  PENDING_APPROVAL:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
  REJECTED:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
  DRAFT:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Disetujui',
  PENDING_APPROVAL: 'Menunggu Approval',
  REJECTED: 'Ditolak',
  DRAFT: 'Draft',
}

const STATUS_HELPERS: Record<string, string> = {
  APPROVED: 'Revisi ini sudah disahkan dan bisa menjadi acuan final.',
  PENDING_APPROVAL: 'Revisi ini menunggu persetujuan approver.',
  REJECTED: 'Revisi ditolak dan perlu diperbarui sebelum diajukan lagi.',
  DRAFT: 'Perubahan masih draf dan belum diajukan.',
}

export default function RABRevisionTimeline({
  revisions,
  finalApprovedRevisionId,
  canReview = false,
  isSubmittingRevisionId,
  onApprove,
  onReject,
}: RABRevisionTimelineProps) {
  if (revisions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
        Belum ada histori revisi untuk proyek ini.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {revisions.map((revision) => {
        const isFinal = revision.id === finalApprovedRevisionId

        return (
          <div
            key={revision.id}
            className={`rounded-xl border p-4 shadow-sm ${isFinal
                ? 'border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/25'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
              }`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Revisi {revision.revisionNumber}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[revision.status] ?? STATUS_STYLES.DRAFT}`}>
                    {STATUS_LABELS[revision.status] ?? STATUS_LABELS.DRAFT}
                  </span>
                  {isFinal && (
                    <span className="inline-flex rounded-full border border-sky-200 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                      Baseline Final
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {STATUS_HELPERS[revision.status] ?? STATUS_HELPERS.DRAFT}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {revision.reason || revision.notes || 'Belum ada catatan revisi'}
                </p>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {format(new Date(revision.updatedAt), 'dd MMM yyyy HH:mm')}
              </div>
            </div>

            {canReview && revision.status === 'PENDING_APPROVAL' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onApprove?.(revision)}
                  disabled={isSubmittingRevisionId === revision.id}
                  className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                >
                  Setujui & Jadikan Final
                </button>
                <button
                  type="button"
                  onClick={() => onReject?.(revision)}
                  disabled={isSubmittingRevisionId === revision.id}
                  className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
                >
                  Tolak dengan Catatan
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
