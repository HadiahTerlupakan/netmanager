type HargaPaketOption = {
  id: string
  name: string
  harga: number
  durasi: number
  durasiUnit: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN'
  profilePPP?: { name: string } | null
  bandwidth?: { name: string } | null
}

type PppClientPackageDateSectionProps = {
  hargaPakets: HargaPaketOption[]
  hargaPaketId: string
  tanggalAktif: string
  jatuhTempo: string
  loading: boolean
  onFieldChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  roundedClassName: string
  actionSlot?: React.ReactNode
}

export function PppClientPackageDateSection({
  hargaPakets,
  hargaPaketId,
  tanggalAktif,
  jatuhTempo,
  loading,
  onFieldChange,
  roundedClassName,
  actionSlot,
}: PppClientPackageDateSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Paket & Tanggal</h3>

      <div className="space-y-2">
        <label htmlFor="hargaPaketId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Harga Paket <span className="text-red-500">*</span>
        </label>
        <select
          id="hargaPaketId"
          name="hargaPaketId"
          required
          value={hargaPaketId}
          onChange={onFieldChange}
          disabled={loading}
          className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <option value="">-- Pilih Harga Paket --</option>
          {hargaPakets.map((paket) => {
            const hargaFormatted = new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              minimumFractionDigits: 0,
            }).format(paket.harga)
            const durasiText = `${paket.durasi} ${paket.durasiUnit.toLowerCase()}`

            return (
              <option key={paket.id} value={paket.id}>
                {paket.name} - {hargaFormatted} / {durasiText}
              </option>
            )
          })}
        </select>
        {hargaPaketId && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {(() => {
              const selectedPaket = hargaPakets.find((paket) => paket.id === hargaPaketId)
              if (!selectedPaket) {
                return ''
              }

              return `Profile PPP: ${selectedPaket.profilePPP?.name || 'Tidak ada'} | bandwidth: ${selectedPaket.bandwidth?.name || 'Tidak ada'}`
            })()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="tanggalAktif" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tanggal Aktif <span className="text-red-500">*</span>
          </label>
          <input
            id="tanggalAktif"
            name="tanggalAktif"
            type="date"
            required
            value={tanggalAktif}
            onChange={onFieldChange}
            className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="jatuhTempo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Jatuh Tempo <span className="text-red-500">*</span>
          </label>
          <input
            id="jatuhTempo"
            name="jatuhTempo"
            type="date"
            required
            value={jatuhTempo}
            onChange={onFieldChange}
            className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
          />
          <p className="text-xs text-gray-500 dark:text-gray-500">Jatuh tempo dihitung otomatis, namun bisa diubah manual jika diperlukan</p>
        </div>
      </div>

      {actionSlot}
    </div>
  )
}
