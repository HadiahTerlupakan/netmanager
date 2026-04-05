import Link from 'next/link'

import { HiArrowDownTray, HiArrowPath } from 'react-icons/hi2'

type PppClientFormActionsProps = {
  error: string | null
  submitting: boolean
  loading: boolean
  roundedClassName: string
  cancelHref: string
  submitLabel?: string
}

export function PppClientFormActions({
  error,
  submitting,
  loading,
  roundedClassName,
  cancelHref,
  submitLabel = 'Simpan',
}: PppClientFormActionsProps) {
  return (
    <>
      {error && (
        <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 ${roundedClassName} p-4`}>
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="submit"
          disabled={submitting || loading}
          className={`inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium ${roundedClassName} hover:bg-indigo-700 dark:hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm`}
        >
          {submitting ? (
            <>
              <HiArrowPath className="w-4 h-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <HiArrowDownTray className="w-4 h-4" />
              {submitLabel}
            </>
          )}
        </button>
        <Link
          href={cancelHref}
          className={`inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium ${roundedClassName} hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}
        >
          Batal
        </Link>
      </div>
    </>
  )
}
