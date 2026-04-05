import type { PppBillingResult } from '@/app/admin/pelanggan/ppp/shared/billing'

type PaketSummary = {
  id: string
  name: string
  harga: number
  durasi: number
  durasiUnit: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN'
  profilePPP?: {
    name: string
  } | null
  bandwidth?: {
    name: string
  } | null
}

type BillingFormSummary = {
  hargaPaketId: string
  biayaInstalasi: number | null
  biayaInstalasiIsRecurring: boolean
  useDiskonBiayaInstalasi: boolean
  biayaSewaPerangkat: number | null
  biayaSewaPerangkatIsRecurring: boolean
  useDiskonSewaPerangkat: boolean
  biayaLainnya: number | null
  biayaLainnyaIsRecurring: boolean
  useDiskonBiayaLainnya: boolean
  keteranganBiayaLainnya: string
  usePPN: boolean
  useProrate: boolean
  useDiscount: boolean
  tanggalAktif: string
  jatuhTempo: string
}

type PppClientBillingSummarySidebarProps = {
  activeTab: 'paket' | 'info'
  formData: BillingFormSummary
  hargaPaketsLength: number
  totalInfo: PppBillingResult<PaketSummary> | null
  formatRupiah: (amount: number) => string
  roundedClassName: string
}

export function PppClientBillingSummarySidebar({
  activeTab,
  formData,
  hargaPaketsLength,
  totalInfo,
  formatRupiah,
  roundedClassName,
}: PppClientBillingSummarySidebarProps) {
  if (activeTab === 'info') {
    return null
  }

  return (
    <>
      <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
        Informasi Tagihan
      </h3>

      {!formData.hargaPaketId || hargaPaketsLength === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {hargaPaketsLength === 0 ? 'Memuat data paket...' : 'Pilih paket untuk melihat detail tagihan'}
          </p>
        </div>
      ) : totalInfo ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Paket Terpilih</h4>
            <div className={`bg-gray-50 dark:bg-gray-700/50 ${roundedClassName} p-3 space-y-1`}>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{totalInfo.paket.name}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Durasi: {totalInfo.paket.durasi} {totalInfo.paket.durasiUnit === 'JAM' ? 'jam' : totalInfo.paket.durasiUnit === 'HARI' ? 'hari' : totalInfo.paket.durasiUnit === 'BULAN' ? 'bulan' : 'tahun'}
              </p>
              {totalInfo.paket.profilePPP && <p className="text-xs text-gray-600 dark:text-gray-400">Profile: {totalInfo.paket.profilePPP.name}</p>}
              {totalInfo.paket.bandwidth && <p className="text-xs text-gray-600 dark:text-gray-400">bandwidth: {totalInfo.paket.bandwidth.name}</p>}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Rincian Tagihan</h4>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Harga Paket</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatRupiah(totalInfo.prorateInfo ? totalInfo.prorateInfo.hargaSebelumProrate : totalInfo.hargaPaket)}
              </span>
            </div>

            {totalInfo.prorateInfo && (
              <>
                <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                  <span>Prorate ({Math.round(totalInfo.prorateInfo.ratio * 100)}%)</span>
                  <span className="font-medium">
                    {totalInfo.prorateInfo.ratio <= 1
                      ? <>- {formatRupiah(totalInfo.prorateInfo.hargaSebelumProrate - totalInfo.prorateInfo.hargaSetelahProrate)}</>
                      : <>+ {formatRupiah(totalInfo.prorateInfo.hargaSetelahProrate - totalInfo.prorateInfo.hargaSebelumProrate)}</>}
                  </span>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                  (Periode: {totalInfo.prorateInfo.selisihHari} hari dari {totalInfo.prorateInfo.durasiPaketHari} hari)
                </div>
              </>
            )}

            {totalInfo.diskon > 0 && (
              <>
                <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                  <span>
                    Diskon {totalInfo.diskonInfo?.isCustom ? '(Custom)' : '(Paket)'}
                    {totalInfo.diskonInfo?.isCustom && totalInfo.diskonInfo?.type && totalInfo.diskonInfo?.value !== null && (
                      <span className="text-xs ml-1">- {totalInfo.diskonInfo.type === 'FIXED' ? formatRupiah(totalInfo.diskonInfo.value) : `${totalInfo.diskonInfo.value}%`}</span>
                    )}
                  </span>
                  <span className="font-medium">- {formatRupiah(totalInfo.diskon)}</span>
                </div>
                {totalInfo.diskonInfo?.duration && totalInfo.diskonInfo?.durationUnit && (
                  <div className="text-xs text-green-600 dark:text-green-400 ml-2">
                    (Berlaku selama {totalInfo.diskonInfo.duration} {totalInfo.diskonInfo.durationUnit === 'JAM' ? 'jam' : totalInfo.diskonInfo.durationUnit === 'HARI' ? 'hari' : totalInfo.diskonInfo.durationUnit === 'BULAN' ? 'bulan' : 'tahun'})
                  </div>
                )}
              </>
            )}

            {(totalInfo.totalBiayaLainnya > 0 || (formData.biayaInstalasi && formData.biayaInstalasi > 0) || (formData.biayaSewaPerangkat && formData.biayaSewaPerangkat > 0) || (formData.biayaLainnya && formData.biayaLainnya > 0)) && (
              <>
                {formData.biayaInstalasi && formData.biayaInstalasi > 0 && (
                  <>
                    <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
                      <span>
                        Biaya Instalasi {formData.biayaInstalasiIsRecurring ? '(Berulang)' : '(1x)'}
                        {formData.useDiskonBiayaInstalasi && totalInfo.biayaInstalasiDiskon && totalInfo.biayaInstalasiDiskon > 0 && <> - Diskon {totalInfo.biayaInstalasiDiskon}%</>}
                      </span>
                      <span className="font-medium">+ {formatRupiah(totalInfo.biayaInstalasi || 0)}</span>
                    </div>
                    {formData.useDiskonBiayaInstalasi && totalInfo.biayaInstalasiDiskon && totalInfo.biayaInstalasiDiskon > 0 && totalInfo.biayaInstalasiSebelumDiskon > 0 && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 ml-2">(Sebelum diskon: {formatRupiah(totalInfo.biayaInstalasiSebelumDiskon)})</div>
                    )}
                  </>
                )}
                {formData.biayaSewaPerangkat && formData.biayaSewaPerangkat > 0 && (
                  <>
                    <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
                      <span>
                        Biaya Sewa Perangkat {formData.biayaSewaPerangkatIsRecurring ? '(Berulang)' : '(1x)'}
                        {formData.useDiskonSewaPerangkat && totalInfo.biayaSewaPerangkatDiskon && totalInfo.biayaSewaPerangkatDiskon > 0 && <> - Diskon {totalInfo.biayaSewaPerangkatDiskon}%</>}
                      </span>
                      <span className="font-medium">+ {formatRupiah(totalInfo.biayaSewaPerangkat || 0)}</span>
                    </div>
                    {formData.useDiskonSewaPerangkat && totalInfo.biayaSewaPerangkatDiskon && totalInfo.biayaSewaPerangkatDiskon > 0 && totalInfo.biayaSewaPerangkatSebelumDiskon > 0 && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 ml-2">(Sebelum diskon: {formatRupiah(totalInfo.biayaSewaPerangkatSebelumDiskon)})</div>
                    )}
                  </>
                )}
                {formData.biayaLainnya && formData.biayaLainnya > 0 && (
                  <>
                    <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
                      <span>
                        Biaya Lainnya {formData.biayaLainnyaIsRecurring ? '(Berulang)' : '(1x)'}
                        {formData.useDiskonBiayaLainnya && totalInfo.biayaLainnyaDiskon && totalInfo.biayaLainnyaDiskon > 0 && <> - Diskon {totalInfo.biayaLainnyaDiskon}%</>}
                        {formData.keteranganBiayaLainnya ? ` (${formData.keteranganBiayaLainnya})` : ''}
                      </span>
                      <span className="font-medium">+ {formatRupiah(totalInfo.biayaLainnya || 0)}</span>
                    </div>
                    {formData.useDiskonBiayaLainnya && totalInfo.biayaLainnyaDiskon && totalInfo.biayaLainnyaDiskon > 0 && totalInfo.biayaLainnyaSebelumDiskon > 0 && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 ml-2">(Sebelum diskon: {formatRupiah(totalInfo.biayaLainnyaSebelumDiskon)})</div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <div className="border-t border-gray-300 dark:border-gray-600 my-3"></div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">Sub Total</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatRupiah(Math.round(Math.max(0, totalInfo.hargaPaket - totalInfo.diskon) + totalInfo.totalBiayaLainnya))}
              </span>
            </div>
            {totalInfo.ppn > 0 && (
              <div className="flex justify-between items-center text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">PPN (VAT)</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">based on company & country regulation</p>
                </div>
                <span className="text-gray-900 dark:text-white font-medium">{formatRupiah(Math.round(totalInfo.ppn))}</span>
              </div>
            )}
            <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-gray-900 dark:text-white">Total</span>
                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{formatRupiah(totalInfo.total)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">PPN</span>
              <span className={`font-medium ${formData.usePPN ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>{formData.usePPN ? 'Aktif' : 'Tidak Aktif'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Prorate</span>
              <span className={`font-medium ${formData.useProrate ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>{formData.useProrate ? 'Aktif' : 'Tidak Aktif'}</span>
            </div>
            {formData.useProrate && totalInfo.prorateInfo && (
              <div className="text-xs text-gray-500 dark:text-gray-400 ml-0">
                Periode: {totalInfo.prorateInfo.selisihHari} hari / {totalInfo.prorateInfo.durasiPaketHari} hari ({Math.round(totalInfo.prorateInfo.ratio * 100)}%)
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Diskon</span>
                <span className={`font-medium ${formData.useDiscount ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>{formData.useDiscount ? 'Aktif' : 'Tidak Aktif'}</span>
              </div>
              {formData.useDiscount && totalInfo.diskonInfo && (
                <div className="text-xs text-gray-500 dark:text-gray-400 ml-0">
                  {totalInfo.diskonInfo.isCustom ? (
                    <>
                      Custom: {totalInfo.diskonInfo.type === 'FIXED' ? formatRupiah(totalInfo.diskonInfo.value) : `${totalInfo.diskonInfo.value}%`}
                      {totalInfo.diskonInfo.duration && totalInfo.diskonInfo.durationUnit && <> - Durasi: {totalInfo.diskonInfo.duration} {totalInfo.diskonInfo.durationUnit === 'JAM' ? 'jam' : totalInfo.diskonInfo.durationUnit === 'HARI' ? 'hari' : totalInfo.diskonInfo.durationUnit === 'BULAN' ? 'bulan' : 'tahun'}</>}
                    </>
                  ) : (
                    <>
                      Paket: {totalInfo.diskonInfo.type === 'FIXED' ? formatRupiah(totalInfo.diskonInfo.value) : `${totalInfo.diskonInfo.value}%`}
                      {totalInfo.diskonInfo.duration && totalInfo.diskonInfo.durationUnit && <> - Durasi: {totalInfo.diskonInfo.duration} {totalInfo.diskonInfo.durationUnit === 'JAM' ? 'jam' : totalInfo.diskonInfo.durationUnit === 'HARI' ? 'hari' : totalInfo.diskonInfo.durationUnit === 'BULAN' ? 'bulan' : 'tahun'}</>}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {formData.tanggalAktif && formData.jatuhTempo && (
            <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Periode Layanan</h4>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>Aktif:</span>
                  <span className="font-medium">{new Date(formData.tanggalAktif).toLocaleDateString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Jatuh Tempo:</span>
                  <span className="font-medium">{new Date(formData.jatuhTempo).toLocaleDateString('id-ID')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat informasi paket...</p>
        </div>
      )}
    </>
  )
}
