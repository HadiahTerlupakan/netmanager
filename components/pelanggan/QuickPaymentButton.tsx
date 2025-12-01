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
            className={`group relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 active:scale-[0.98] ${className}`}
        >
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>

            <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                        <HiOutlineCreditCard className="w-7 h-7" />
                    </div>
                    <div>
                        <div className="text-xs text-green-100 font-medium mb-0.5">Tagihan Belum Dibayar</div>
                        <div className="text-2xl font-bold">{formatRupiah(amount)}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <span>Bayar</span>
                    <HiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
            </div>
        </Link>
    )
}
