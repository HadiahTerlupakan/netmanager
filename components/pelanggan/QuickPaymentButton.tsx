import Link from 'next/link'
import { HiOutlineCreditCard, HiArrowRight } from 'react-icons/hi2'

interface QuickPaymentButtonProps {
    tagihanId: string
    amount: number
    className?: string
}

export function QuickPaymentButton({ tagihanId, amount, className = '' }: QuickPaymentButtonProps) {
    const formatRupiah = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    return (
        <Link
            href={`/pelanggan/tagihan/${tagihanId}/bayar`}
            className={`group relative overflow-hidden bg-white dark:bg-gray-800 border-2 border-green-500 hover:border-green-600 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] ${className}`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center shrink-0">
                        <HiOutlineCreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Tagihan Belum Dibayar</div>
                        <div className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">{formatRupiah(amount)}</div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400 shrink-0 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors">
                    <span>Bayar</span>
                    <HiArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                </div>
            </div>
        </Link>
    )
}
