import { HiExclamationTriangle, HiArrowRight } from 'react-icons/hi2'
import Link from 'next/link'

interface PaymentReminderProps {
    daysUntilDue: number
    amount: number
    tagihanId: string
    status: 'BELUM_LUNAS' | 'TERLAMBAT'
}

export function PaymentReminderBanner({ daysUntilDue, amount, tagihanId, status }: PaymentReminderProps) {
    const formatRupiah = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    const isUrgent = daysUntilDue <= 3 || status === 'TERLAMBAT'
    const isWarning = daysUntilDue > 3 && daysUntilDue <= 7

    if (status === 'TERLAMBAT') {
        return (
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl p-4 md:p-5 lg:p-6 shadow-lg animate-pulse">
                <div className="flex items-start gap-3 md:gap-4 lg:gap-5">
                    <HiExclamationTriangle className="w-7 h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base md:text-lg lg:text-xl mb-2 leading-tight">⚠️ Tagihan Sudah Jatuh Tempo!</h3>
                        <p className="text-xs md:text-sm lg:text-base text-red-50 mb-4 leading-relaxed">
                            Tagihan Anda sebesar <strong className="font-bold">{formatRupiah(amount)}</strong> sudah melewati jatuh tempo.
                            Layanan internet mungkin terputus. Segera lakukan pembayaran!
                        </p>
                        <Link
                            href={`/pelanggan/tagihan/${tagihanId}/bayar`}
                            className="inline-flex items-center justify-center gap-2 bg-white text-red-600 px-5 py-3 md:px-6 md:py-3 rounded-xl font-semibold hover:bg-red-50 transition-all duration-200 shadow-md active:scale-95 min-h-[44px] touch-manipulation"
                        >
                            Bayar Sekarang
                            <HiArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (isUrgent) {
        return (
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl p-4 md:p-5 lg:p-6 shadow-lg">
                <div className="flex items-start gap-3 md:gap-4 lg:gap-5">
                    <HiExclamationTriangle className="w-6 h-6 md:w-7 md:h-8 lg:w-8 lg:h-8 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base md:text-lg lg:text-xl mb-2 leading-tight">Tagihan Segera Jatuh Tempo!</h3>
                        <p className="text-xs md:text-sm lg:text-base text-orange-50 mb-4 leading-relaxed">
                            Bayar dalam <strong className="font-bold">{daysUntilDue} hari</strong> ({formatRupiah(amount)}) untuk menghindari gangguan layanan.
                        </p>
                        <Link
                            href={`/pelanggan/tagihan/${tagihanId}/bayar`}
                            className="inline-flex items-center justify-center gap-2 bg-white text-orange-600 px-5 py-3 md:px-6 md:py-3 rounded-xl font-semibold hover:bg-orange-50 transition-all duration-200 shadow-md active:scale-95 min-h-[44px] touch-manipulation"
                        >
                            Bayar Sekarang
                            <HiArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (isWarning) {
        return (
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 dark:text-gray-900 rounded-2xl p-4 md:p-5 lg:p-6 shadow-md">
                <div className="flex items-start gap-3 md:gap-4 lg:gap-5">
                    <HiExclamationTriangle className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm md:text-base lg:text-lg mb-2 leading-tight">Reminder Pembayaran</h3>
                        <p className="text-xs md:text-sm lg:text-base mb-4 leading-relaxed">
                            Tagihan {formatRupiah(amount)} akan jatuh tempo dalam <strong className="font-bold">{daysUntilDue} hari</strong>.
                        </p>
                        <Link
                            href={`/pelanggan/tagihan/${tagihanId}/bayar`}
                            className="inline-flex items-center justify-center gap-2 bg-white text-yellow-700 px-4 py-3 md:px-5 md:py-3 rounded-xl font-medium hover:bg-yellow-50 transition-all duration-200 shadow-sm text-sm md:text-base active:scale-95 min-h-[44px] touch-manipulation"
                        >
                            Lihat Tagihan
                            <HiArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return null
}
