type PppStatusOption = {
  value: string
  label: string
  accentClassName?: string
}

type PppClientStatusTypeSectionProps = {
  status: string
  tipe: 'REGULER' | 'NON_REGULER'
  autoIsolir: boolean
  statusOptions: PppStatusOption[]
  onStatusChange: (value: string) => void
  onTipeChange: (value: 'REGULER' | 'NON_REGULER') => void
  onAutoIsolirChange: (checked: boolean) => void
}

export function PppClientStatusTypeSection({
  status,
  tipe,
  autoIsolir,
  statusOptions,
  onStatusChange,
  onTipeChange,
  onAutoIsolirChange,
}: PppClientStatusTypeSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="space-y-4">
        <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Status Registrasi</h3>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status Registrasi <span className="text-red-500">*</span>
          </span>
          <div className="flex flex-wrap items-center gap-6">
            {statusOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value={option.value}
                  checked={status === option.value}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className={`w-4 h-4 ${option.accentClassName ?? 'text-indigo-600'} bg-gray-100 border-gray-300 focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600`}
                  required
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  name="autoIsolir"
                  checked={autoIsolir}
                  onChange={(e) => onAutoIsolirChange(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Isolir</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Otomatis isolir jika melewati jatuh tempo + toleransi</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Tipe Pelanggan</h3>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tipe Pelanggan <span className="text-red-500">*</span>
          </span>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipe"
                value="REGULER"
                checked={tipe === 'REGULER'}
                onChange={(e) => onTipeChange(e.target.value as 'REGULER' | 'NON_REGULER')}
                className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                required
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reguler</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipe"
                value="NON_REGULER"
                checked={tipe === 'NON_REGULER'}
                onChange={(e) => onTipeChange(e.target.value as 'REGULER' | 'NON_REGULER')}
                className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                required
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Non Reguler</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
