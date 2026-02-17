"use client"

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/common/StatusBadge'
import { HiXMark, HiCurrencyDollar, HiClock, HiTag, HiServer, HiSignal } from 'react-icons/hi2'
import { FiMonitor } from 'react-icons/fi'

type HargaPaketDetailModalProps = {
  open: boolean
  onClose: () => void
  paketId: string | null
}

type HargaPaketDetail = {
  id: string
  name: string
  harga: number
  durasi: number
  durasiUnit: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN'
  usePPN: boolean
  ppnPercentage?: number | null
  useDiscount: boolean
  discountType?: 'FIXED' | 'PERCENT' | null
  discountValue?: number | null
  discountDuration?: number | null
  discountDurationUnit?: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null
  description?: string | null
  featured: boolean
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  site?: {
    name: string
    code: string
  } | null
  profilePPP: {
    name: string
    mikroTikRouter?: {
      name: string
      ipAddress: string
    } | null
  }
  bandwidth?: {
    name: string
    maxLimitDownload: string
    maxLimitUpload: string
  } | null
}

export default function HargaPaketDetailModal({ open, onClose, paketId }: HargaPaketDetailModalProps) {
  const [paket, setPaket] = useState<HargaPaketDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && paketId) {
      loadDetail(paketId)
    } else {
      setPaket(null)
      setError(null)
    }
  }, [open, paketId])

  const loadDetail = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hargapakets/${id}`)
      if (!res.ok) throw new Error('Gagal memuat detail paket')
      const result = await res.json()
      setPaket(result.data || result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const DetailItem = ({ label, value, icon: Icon, className = "" }: { label: string, value: React.ReactNode, icon?: React.ElementType, className?: string }) => (
    <div className={`p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 ${className}`}>
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
      </div>
      <div className="font-semibold text-gray-900 dark:text-white break-all">
        {value || <span className="text-gray-400 dark:text-gray-600 italic">Tidak diset</span>}
      </div>
    </div>
  )

  const calculateTotal = () => {
    if (!paket) return 0

    let price = paket.harga

    // Apply discount if enabled
    if (paket.useDiscount && paket.discountType && paket.discountValue) {
        if (paket.discountType === 'FIXED') {
            price = Math.max(0, price - paket.discountValue)
        } else {
            price = Math.round(price * (1 - paket.discountValue / 100))
        }
    }

    // Apply PPN if enabled
    if (paket.usePPN && paket.ppnPercentage) {
        price = Math.round(price * (1 + paket.ppnPercentage / 100))
    }

    return price
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Detail Harga Paket"
      size="2xl"
    >
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20">
            <HiXMark className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">{error}</p>
        </div>
      ) : paket ? (
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-700 pb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{paket.name}</h3>
                <StatusBadge status={paket.status} />
                {paket.featured && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
                        Unggulan
                    </span>
                )}
              </div>
              <p className="text-gray-500 dark:text-gray-400 max-w-lg">
                {paket.description || "Tidak ada deskripsi"}
              </p>
            </div>
            {paket.site && (
                <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full border border-indigo-100 dark:border-indigo-800">
                    {paket.site.name} ({paket.site.code})
                </div>
            )}
          </div>

          {/* Pricing Calculation */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4">
                <HiCurrencyDollar className="w-4 h-4 text-green-500" />
                RINCIAN HARGA
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <DetailItem label="Harga Dasar" value={formatRupiah(paket.harga)} />
                <DetailItem label="Durasi" value={`${paket.durasi} ${paket.durasiUnit}`} icon={HiClock} />
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30">
                    <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">Total Tagihan</span>
                    </div>
                    <div className="font-bold text-xl text-gray-900 dark:text-white">
                        {formatRupiah(calculateTotal())}
                    </div>
                </div>
            </div>

            {(paket.useDiscount || paket.usePPN) && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Kalkulasi Tambahan</h5>
                    <div className="space-y-2">
                        {paket.useDiscount && paket.discountValue && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                    <HiTag className="w-4 h-4 text-orange-500" />
                                    Diskon ({paket.discountType === 'PERCENT' ? `${paket.discountValue}%` : 'Fixed'})
                                </span>
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
                                            ? (paket.discountType === 'FIXED'
                                                ? Math.max(0, paket.harga - paket.discountValue)
                                                : Math.round(paket.harga * (1 - paket.discountValue / 100)))
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

          {/* Technical Configuration */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4 mt-6">
                <FiMonitor className="w-4 h-4 text-indigo-500" />
                KONFIGURASI TEKNIS
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailItem
                label="Profile PPP"
                value={paket.profilePPP.name}
                className="bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/20"
              />

              <DetailItem
                label="Router MikroTik"
                value={paket.profilePPP.mikroTikRouter ? (
                    <div className="flex flex-col">
                        <span>{paket.profilePPP.mikroTikRouter.name}</span>
                        <span className="text-xs font-normal text-gray-500">{paket.profilePPP.mikroTikRouter.ipAddress}</span>
                    </div>
                ) : <span className="text-gray-400 italic">Tidak terhubung ke router</span>}
                icon={HiServer}
              />

              <div className="md:col-span-2">
                <div className={`p-4 rounded-xl border ${paket.bandwidth ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/20' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50'}`}>
                    <div className="flex items-start justify-between mb-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <HiSignal className="w-4 h-4" />
                            Bandwidth / Rate Limit
                        </span>
                        {paket.bandwidth && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded uppercase">
                                {paket.bandwidth.name}
                            </span>
                        )}
                    </div>
                    {paket.bandwidth ? (
                        <div className="flex items-center gap-8">
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Download</div>
                                <div className="text-lg font-bold text-gray-900 dark:text-white">{paket.bandwidth.maxLimitDownload}</div>
                            </div>
                            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Upload</div>
                                <div className="text-lg font-bold text-gray-900 dark:text-white">{paket.bandwidth.maxLimitUpload}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-500 dark:text-gray-400 italic text-sm">
                            Rate limit mengikuti setting default Profile PPP
                        </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
