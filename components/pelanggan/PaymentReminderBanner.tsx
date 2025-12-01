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
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl p-5 mb-6 shadow-lg animate-pulse">
                <div className="flex items-start gap-4">
                    <HiExclamationTriangle className="w-8 h-8 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-bold text-lg mb-1">⚠️ Tagihan Sudah Jatuh Tempo!</h3>
                        <p className="text-sm text-red-50 mb-3">
                            Tagihan Anda sebesar <strong>{formatRupiah(amount)}</strong> sudah melewati jatuh tempo.
                            Layanan internet mungkin terputus. Segera lakukan pembayaran!
                        </p>
                        <Link
                            href={`/pelanggan/tagihan/${tagihanId}/bayar`}
                            className="inline-flex items-center gap-2 bg-white text-red-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-red-50 transition-colors shadow-md active:scale-95"
                        >
                            Bayar Sekarang
                            <HiArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (isUrgent) {
        return (
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl p-5 mb-6 shadow-lg">
                <div className="flex items-start gap-4">
                    <HiExclamationTriangle className="w-7 h-7 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-bold text-lg mb-1">Tagihan Segera Jatuh Tempo!</h3>
                        <p className="text-sm text-orange-50 mb-3">
                            Bayar dalam <strong>{daysUntilDue} hari</strong> ({formatRupiah(amount)}) untuk menghindari gangguan layanan.
                        </p>
                        <Link
                            href={`/pelanggan/tagihan/${tagihanId}/bayar`}
                            className="inline-flex items-center gap-2 bg-white text-orange-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-orange-50 transition-colors shadow-md active:scale-95"
                        >
                            Bayar Sekarang
                            <HiArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (isWarning) {
        return (
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 rounded-xl p-4 mb-6 shadow-md">
                <div className="flex items-start gap-3">
                    <HiExclamationTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-semibold mb-1">Reminder Pembayaran</h3>
                        <p className="text-sm mb-3">
                            Tagihan {formatRupiah(amount)} akan jatuh tempo dalam <strong>{daysUntilDue} hari</strong>.
                        </p>
                        <Link
                            href={`/pelanggan/tagihan/${tagihanId}/bayar`}
                            className="inline-flex items-center gap-2 bg-white text-yellow-700 px-4 py-2 rounded-lg font-medium hover:bg-yellow-50 transition-colors shadow-sm text-sm active:scale-95"
                        >
                            Lihat Tagihan
                            <HiArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return null
}
