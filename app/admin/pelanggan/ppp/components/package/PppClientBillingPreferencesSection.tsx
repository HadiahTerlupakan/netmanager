export type PppClientBillingPreferencesFormData = {
  usePPN: boolean
  useProrate: boolean
  useDiscount: boolean
  discountType: 'FIXED' | 'PERCENT' | null
  discountValue: number | null
  discountDuration: number | null
  discountDurationUnit: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null
  biayaInstalasi: number | null
  biayaInstalasiIsRecurring: boolean
  useDiskonBiayaInstalasi: boolean
  biayaInstalasiDiskon: number | null
  biayaSewaPerangkat: number | null
  biayaSewaPerangkatIsRecurring: boolean
  useDiskonSewaPerangkat: boolean
  biayaSewaPerangkatDiskon: number | null
  biayaLainnya: number | null
  biayaLainnyaIsRecurring: boolean
  useDiskonBiayaLainnya: boolean
  biayaLainnyaDiskon: number | null
  keteranganBiayaLainnya: string
}

type PppClientBillingPreferencesSectionProps = {
  formData: PppClientBillingPreferencesFormData
  handleChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  updateFormData: (updater: (prev: PppClientBillingPreferencesFormData) => Partial<PppClientBillingPreferencesFormData>) => void
  formatRupiah: (amount: number) => string
  roundedClassName: string
}

export function PppClientBillingPreferencesSection({
  formData,
  handleChange,
  updateFormData,
  formatRupiah,
  roundedClassName,
}: PppClientBillingPreferencesSectionProps) {
  return (
    <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Pengaturan Pajak & Diskon</h4>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="usePPN"
            checked={formData.usePPN}
            onChange={(e) => updateFormData(() => ({ usePPN: e.target.checked }))}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Gunakan PPN</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">Centang jika pelanggan ini dikenakan PPN (Pajak Pertambahan Nilai)</p>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="useProrate"
            checked={formData.useProrate}
            onChange={(e) => updateFormData(() => ({ useProrate: e.target.checked }))}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Gunakan Prorate</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">Centang untuk menghitung tagihan berdasarkan proporsi waktu (jika pelanggan aktif tidak sesuai durasi paket penuh)</p>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="useDiscount"
            checked={formData.useDiscount}
            onChange={(e) => updateFormData(() => ({
              useDiscount: e.target.checked,
              ...(e.target.checked ? {} : {
                discountType: null,
                discountValue: null,
                discountDuration: null,
                discountDurationUnit: null,
              }),
            }))}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Gunakan Diskon</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">Centang jika pelanggan ini mendapatkan diskon. Jika tidak diisi custom diskon, akan menggunakan diskon dari paket.</p>
      </div>

      {formData.useDiscount && (
        <div className={`space-y-3 mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 ${roundedClassName} border border-gray-200 dark:border-gray-600`}>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Custom Diskon (Opsional)</h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Jika diisi, akan override diskon dari paket. Kosongkan untuk menggunakan diskon dari paket.</p>

          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jenis Diskon</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="customDiscountType"
                  value="FIXED"
                  checked={formData.discountType === 'FIXED'}
                  onChange={(e) => updateFormData(() => ({ discountType: e.target.value as 'FIXED' | 'PERCENT', discountValue: null }))}
                  className="border-gray-300 dark:border-gray-700"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Fixed (Nominal Tetap)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="customDiscountType"
                  value="PERCENT"
                  checked={formData.discountType === 'PERCENT'}
                  onChange={(e) => updateFormData(() => ({ discountType: e.target.value as 'FIXED' | 'PERCENT', discountValue: null }))}
                  className="border-gray-300 dark:border-gray-700"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Persen (%)</span>
              </label>
            </div>
          </div>

          {formData.discountType && (
            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nilai Diskon {formData.discountType === 'FIXED' ? '(Rp)' : '(%)'}</span>
              <input
                type="number"
                min="0"
                max={formData.discountType === 'PERCENT' ? 100 : undefined}
                step={formData.discountType === 'PERCENT' ? '0.01' : '1'}
                value={formData.discountValue || ''}
                onChange={(e) => updateFormData(() => ({ discountValue: e.target.value ? parseFloat(e.target.value) : null }))}
                className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
                placeholder={formData.discountType === 'FIXED' ? '50000' : '10'}
              />
            </div>
          )}

          {formData.discountType && formData.discountValue && (
            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Durasi Diskon</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={formData.discountDuration || ''}
                  onChange={(e) => updateFormData(() => ({ discountDuration: e.target.value ? parseInt(e.target.value) : null }))}
                  className={`flex-1 ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
                  placeholder="30"
                />
                <select
                  value={formData.discountDurationUnit || ''}
                  onChange={(e) => updateFormData(() => ({ discountDurationUnit: e.target.value as 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null }))}
                  className={`w-32 ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
                >
                  <option value="">Pilih Unit</option>
                  <option value="JAM">Jam</option>
                  <option value="HARI">Hari</option>
                  <option value="BULAN">Bulan</option>
                  <option value="TAHUN">Tahun</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Biaya Lain-lain</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">Tambahkan biaya tambahan jika diperlukan (opsional)</p>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="biayaInstalasi" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Biaya Instalasi (Rp)</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.biayaInstalasiIsRecurring} onChange={(e) => updateFormData(() => ({ biayaInstalasiIsRecurring: e.target.checked }))} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Berulang</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.useDiskonBiayaInstalasi} onChange={(e) => updateFormData(() => ({ useDiskonBiayaInstalasi: e.target.checked, ...(e.target.checked ? {} : { biayaInstalasiDiskon: null }) }))} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Diskon</span>
                </label>
              </div>
            </div>
            <input id="biayaInstalasi" name="biayaInstalasi" type="number" min="0" step="1" value={formData.biayaInstalasi || ''} onChange={(e) => updateFormData(() => ({ biayaInstalasi: e.target.value ? parseInt(e.target.value) : null }))} className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`} placeholder="0" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formData.biayaInstalasiIsRecurring ? 'Biaya akan ditagih setiap periode' : 'Biaya hanya ditagih 1x'}</p>
            {formData.biayaInstalasi && formData.biayaInstalasi > 0 && formData.useDiskonBiayaInstalasi && (
              <div className="mt-2">
                <label htmlFor="biayaInstalasiDiskon" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Diskon Biaya Instalasi (%)</label>
                <input id="biayaInstalasiDiskon" name="biayaInstalasiDiskon" type="number" min="0" max="100" step="0.01" value={formData.biayaInstalasiDiskon || ''} onChange={(e) => updateFormData(() => ({ biayaInstalasiDiskon: e.target.value ? parseFloat(e.target.value) : null }))} className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`} placeholder="0" />
                {formData.biayaInstalasiDiskon && formData.biayaInstalasiDiskon > 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Diskon: {formData.biayaInstalasiDiskon}% = {formatRupiah(Math.round((formData.biayaInstalasi * formData.biayaInstalasiDiskon) / 100))}</p>}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="biayaSewaPerangkat" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Biaya Sewa Perangkat (Rp)</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.biayaSewaPerangkatIsRecurring} onChange={(e) => updateFormData(() => ({ biayaSewaPerangkatIsRecurring: e.target.checked }))} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Berulang</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.useDiskonSewaPerangkat} onChange={(e) => updateFormData(() => ({ useDiskonSewaPerangkat: e.target.checked, ...(e.target.checked ? {} : { biayaSewaPerangkatDiskon: null }) }))} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Diskon</span>
                </label>
              </div>
            </div>
            <input id="biayaSewaPerangkat" name="biayaSewaPerangkat" type="number" min="0" step="1" value={formData.biayaSewaPerangkat || ''} onChange={(e) => updateFormData(() => ({ biayaSewaPerangkat: e.target.value ? parseInt(e.target.value) : null }))} className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`} placeholder="0" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formData.biayaSewaPerangkatIsRecurring ? 'Biaya akan ditagih setiap periode' : 'Biaya hanya ditagih 1x'}</p>
            {formData.biayaSewaPerangkat && formData.biayaSewaPerangkat > 0 && formData.useDiskonSewaPerangkat && (
              <div className="mt-2">
                <label htmlFor="biayaSewaPerangkatDiskon" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Diskon Sewa Perangkat (%)</label>
                <input id="biayaSewaPerangkatDiskon" name="biayaSewaPerangkatDiskon" type="number" min="0" max="100" step="0.01" value={formData.biayaSewaPerangkatDiskon || ''} onChange={(e) => updateFormData(() => ({ biayaSewaPerangkatDiskon: e.target.value ? parseFloat(e.target.value) : null }))} className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`} placeholder="0" />
                {formData.biayaSewaPerangkatDiskon && formData.biayaSewaPerangkatDiskon > 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Diskon: {formData.biayaSewaPerangkatDiskon}% = {formatRupiah(Math.round((formData.biayaSewaPerangkat * formData.biayaSewaPerangkatDiskon) / 100))}</p>}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="biayaLainnya" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Biaya Lainnya (Rp)</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.biayaLainnyaIsRecurring} onChange={(e) => updateFormData(() => ({ biayaLainnyaIsRecurring: e.target.checked }))} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Berulang</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.useDiskonBiayaLainnya} onChange={(e) => updateFormData(() => ({ useDiskonBiayaLainnya: e.target.checked, ...(e.target.checked ? {} : { biayaLainnyaDiskon: null }) }))} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Diskon</span>
                </label>
              </div>
            </div>
            <input id="biayaLainnya" name="biayaLainnya" type="number" min="0" step="1" value={formData.biayaLainnya || ''} onChange={(e) => updateFormData(() => ({ biayaLainnya: e.target.value ? parseInt(e.target.value) : null }))} className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`} placeholder="0" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formData.biayaLainnyaIsRecurring ? 'Biaya akan ditagih setiap periode' : 'Biaya hanya ditagih 1x'}</p>
            {formData.biayaLainnya && formData.biayaLainnya > 0 && formData.useDiskonBiayaLainnya && (
              <div className="mt-2">
                <label htmlFor="biayaLainnyaDiskon" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Diskon Biaya Lainnya (%)</label>
                <input id="biayaLainnyaDiskon" name="biayaLainnyaDiskon" type="number" min="0" max="100" step="0.01" value={formData.biayaLainnyaDiskon || ''} onChange={(e) => updateFormData(() => ({ biayaLainnyaDiskon: e.target.value ? parseFloat(e.target.value) : null }))} className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`} placeholder="0" />
                {formData.biayaLainnyaDiskon && formData.biayaLainnyaDiskon > 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Diskon: {formData.biayaLainnyaDiskon}% = {formatRupiah(Math.round((formData.biayaLainnya * formData.biayaLainnyaDiskon) / 100))}</p>}
              </div>
            )}
          </div>

          {formData.biayaLainnya && formData.biayaLainnya > 0 && (
            <div>
              <label htmlFor="keteranganBiayaLainnya" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan Biaya Lainnya</label>
              <input id="keteranganBiayaLainnya" name="keteranganBiayaLainnya" type="text" value={formData.keteranganBiayaLainnya} onChange={handleChange} className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`} placeholder="Keterangan biaya lainnya" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
