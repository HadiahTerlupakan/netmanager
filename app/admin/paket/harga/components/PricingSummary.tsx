import { calculateDiscountedPrice, calculateHargaDetailTotal, formatRupiah } from '@/app/admin/paket/harga/lib/hargaPricing'
import type { HargaFormData, HargaPaketDetail } from '@/app/admin/paket/harga/lib/hargaTypes'

type PricingSummaryProps =
  | {
      mode: 'form'
      formData: HargaFormData
    }
  | {
      mode: 'detail'
      paket: HargaPaketDetail
    }

export function PricingSummary(props: PricingSummaryProps) {
  if (props.mode === 'form') {
    const { formData } = props
    const discountedPrice = formData.useDiscount && formData.discountType && formData.discountValue
      ? calculateDiscountedPrice(formData.harga, formData.discountType, formData.discountValue)
      : null
    const ppnValue = formData.usePPN && formData.ppnPercentage
      ? Math.round(formData.harga * (formData.ppnPercentage / 100))
      : null
    const ppnTotal = formData.usePPN && formData.ppnPercentage
      ? Math.round(formData.harga * (1 + formData.ppnPercentage / 100))
      : null

    return (
      <div className="space-y-3">
        {formData.usePPN && formData.ppnPercentage && ppnValue !== null && ppnTotal !== null && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            PPN: {formatRupiah(ppnValue)} (Total: {formatRupiah(ppnTotal)})
          </p>
        )}
        {formData.useDiscount && formData.discountType && formData.discountValue && discountedPrice !== null && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Diskon: {formData.discountType === 'FIXED' ? formatRupiah(formData.discountValue) : `${formData.discountValue}% (${formatRupiah(Math.round(formData.harga * (formData.discountValue / 100)))})`}
            {' '}(Harga Setelah Diskon: {formatRupiah(discountedPrice)})
          </p>
        )}
      </div>
    )
  }

  const { paket } = props
  const total = calculateHargaDetailTotal(paket)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Harga Dasar</span>
          <div className="font-semibold text-gray-900 dark:text-white break-all mt-1">{formatRupiah(paket.harga)}</div>
        </div>
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Durasi</span>
          <div className="font-semibold text-gray-900 dark:text-white break-all mt-1">{paket.durasi} {paket.durasiUnit}</div>
        </div>
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30">
          <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">Total Tagihan</span>
          <div className="font-bold text-xl text-gray-900 dark:text-white mt-1">{formatRupiah(total)}</div>
        </div>
      </div>

      {(paket.useDiscount || paket.usePPN) && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Kalkulasi Tambahan</h5>
          <div className="space-y-2">
            {paket.useDiscount && paket.discountValue && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-300">Diskon ({paket.discountType === 'PERCENT' ? `${paket.discountValue}%` : 'Fixed'})</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  - {formatRupiah(
                    paket.discountType === 'FIXED'
                      ? paket.discountValue
                      : Math.round(paket.harga * (paket.discountValue / 100))
                  )}
                </span>
              </div>
            )}
            {paket.usePPN && paket.ppnPercentage && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-300">PPN ({paket.ppnPercentage}%)</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  + {formatRupiah(Math.round(
                    (paket.useDiscount && paket.discountValue
                      ? calculateDiscountedPrice(paket.harga, paket.discountType, paket.discountValue)
                      : paket.harga
                    ) * (paket.ppnPercentage / 100)
                  ))}
                </span>
              </div>
            )}
            {paket.useDiscount && paket.discountDuration && (
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                * Diskon berlaku selama {paket.discountDuration} {paket.discountDurationUnit} pertama
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
