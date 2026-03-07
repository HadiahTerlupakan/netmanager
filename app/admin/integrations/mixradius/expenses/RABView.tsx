/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import {
    HiOutlineDocumentText,
    HiOutlineCube,
    HiOutlineCalculator,
    HiOutlineBuildingOffice,
    HiOutlineArrowTrendingUp,
    HiOutlineCalendar,
    HiOutlineUsers,
    HiOutlineChartBar,
    HiOutlinePencilSquare,
    HiOutlineCheck,
    HiOutlineXMark,
    HiOutlineBanknotes
} from 'react-icons/hi2'
import { useSession } from 'next-auth/react'
import type { RABProject } from './RABList'
import { calculateRealisticBEP, calculateMonthlySubscribers } from './RABList'

interface RABViewProps {
    isOpen: boolean
    data: RABProject | null
    onClose: () => void
}


export default function RABView({ isOpen, data, onClose }: RABViewProps) {
    const { data: session } = useSession()
    const currentUser = session?.user
    const [actuals, setActuals] = useState<RABProject['actualAchievements']>([])
    const [editingMonth, setEditingMonth] = useState<number | null>(null)
    const [editForm, setEditForm] = useState({
        actualSubscribers: 0,
        actualRevenue: '',
        manualRecoveryInstallment: '',
        manualInvestorShare: '',
        manualCompanyShare: '',
        manualInvestorProfitSharePercent: ''
    })
    const [isSavingActual, setIsSavingActual] = useState(false)
    const [isApproving, setIsApproving] = useState(false)

    useEffect(() => {
        if (data) {
            setActuals(data.actualAchievements || [])
        }
    }, [data])

    if (!data) return null

    const capexItems = data.items.filter(i => !i.expenseType || i.expenseType === 'CAPEX')

    const totalCapex = capexItems.reduce((sum, item) => sum + Number(item.totalPrice), 0)
    const contingencyAmount = Number(data.contingencyAmount || 0)
    const contingencyPercent = data.contingencyPercent || 0
    const totalInvestment = totalCapex + contingencyAmount
    const totalOpex = Number(data.projectedOpex || 0)

    const projectedRevenue = Number(data.projectedRevenue || 0)
    const { bepMonth, simpleBep, monthsToFullCapacity, roiPerYear } = calculateRealisticBEP(data)

    const getGrowthTypeLabel = (type?: string) => {
        switch (type) {
            case 'LINEAR': return 'Linear'
            case 'PERCENTAGE': return 'Persentase'
            case 'CUSTOM': return 'Kustom'
            default: return '-'
        }
    }

    const startYear = data.startDate ? new Date(data.startDate).getFullYear() : new Date().getFullYear()
    const maxMonthsToShow = data.investmentDurationMonths || 12
    const monthlySubsTargets = calculateMonthlySubscribers(
        data.targetSubscribers || 0,
        data.growthType || 'LINEAR',
        data.growthSettings || null,
        maxMonthsToShow
    )
    const arpu = Number(data.arpu || 0)

    const handleEditClick = (monthIndex: number, defaultSubs: number, defaultRev: number) => {
        const existing = actuals.find(a => a.month === monthIndex)
        setEditingMonth(monthIndex)
        setEditForm({
            actualSubscribers: existing ? Number(existing.actualSubscribers) : defaultSubs,
            actualRevenue: existing ? String(existing.actualRevenue) : String(defaultRev),
            manualRecoveryInstallment: existing?.manualRecoveryInstallment ? String(existing.manualRecoveryInstallment) : '',
            manualInvestorShare: existing?.manualInvestorShare ? String(existing.manualInvestorShare) : '',
            manualCompanyShare: existing?.manualCompanyShare ? String(existing.manualCompanyShare) : '',
            manualInvestorProfitSharePercent: existing?.manualInvestorProfitSharePercent ? String(existing.manualInvestorProfitSharePercent) : ''
        })
    }

    const handleSaveActual = async (monthIndex: number) => {
        setIsSavingActual(true)
        try {
            const res = await fetch(`/api/finance/rab-projects/${data.id}/actuals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month: monthIndex,
                    year: startYear + Math.floor((monthIndex - 1) / 12),
                    actualSubscribers: editForm.actualSubscribers,
                    actualRevenue: editForm.actualRevenue.replace(/[^0-9]/g, ''),
                    manualRecoveryInstallment: editForm.manualRecoveryInstallment.replace(/[^0-9]/g, '') || null,
                    manualInvestorShare: editForm.manualInvestorShare.replace(/[^0-9]/g, '') || null,
                    manualCompanyShare: editForm.manualCompanyShare.replace(/[^0-9]/g, '') || null,
                    manualInvestorProfitSharePercent: editForm.manualInvestorProfitSharePercent ? parseFloat(editForm.manualInvestorProfitSharePercent) : null
                })
            })
            const json = await res.json()
            if (json.success) {
                setActuals(prev => {
                    const filtered = prev.filter(a => a.month !== monthIndex)
                    return [...filtered, json.data].sort((a, b) => a.month - b.month)
                })
                setEditingMonth(null)
                toast.success('Pencapaian aktual berhasil disimpan!')
            } else {
                toast.error(json.error || 'Gagal menyimpan data')
            }
        } catch (_error) {
            toast.error('Gagal terhubung ke server')
        } finally {
            setIsSavingActual(false)
        }
    }

    const handleStatusTransition = async (newStatus: string) => {
        setIsApproving(true)
        try {
            const res = await fetch(`/api/finance/rab-projects/${data.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            const json = await res.json()
            if (json.success) {
                toast.success(`Status berhasil diubah ke ${newStatus}`)
                // Update local data optimistically
                Object.assign(data, { status: newStatus })
            } else {
                toast.error(json.error || 'Gagal mengubah status')
            }
        } catch (_error) {
            toast.error('Gagal terhubung ke server')
        } finally {
            setIsApproving(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            case 'PENDING_APPROVAL': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            case 'APPROVED': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
            case 'REJECTED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            case 'PENGADAAN': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
            case 'PENGGELARAN_JARINGAN': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
            case 'PENJUALAN': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
            case 'TARGET_TERCAPAI': return 'bg-emerald-500 text-white font-bold'
            case 'SELESAI': return 'bg-gray-800 text-white dark:bg-white dark:text-gray-900 font-bold'
            default: return 'bg-gray-100 text-gray-600'
        }
    }

    const renderActionButtons = () => {
        const canManage = (currentUser as any)?.isSuperAdmin || (currentUser as any)?.canApproveRab
        if (!canManage) return null

        switch (data.status) {
            case 'DRAFT':
            case 'PENDING_APPROVAL':
                return !data.approvals?.some(a => a.userId === currentUser.id) && (
                    <button
                        onClick={async () => {
                            setIsApproving(true)
                            try {
                                const res = await fetch(`/api/integrations/mixradius/expenses/rab/${data.id}/approve`, { method: 'POST' })
                                const json = await res.json()
                                if (res.ok) {
                                    toast.success(json.message)
                                    if (json.data) Object.assign(data, json.data)
                                } else {
                                    toast.error(json.error || 'Gagal menyetujui RAB')
                                }
                            } catch (_e) {
                                toast.error('Gagal menghubungi server')
                            } finally {
                                setIsApproving(false)
                            }
                        }}
                        disabled={isApproving}
                        className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                        {isApproving ? 'Memproses...' : (
                            <>
                                <HiOutlineCheck className="w-4 h-4" />
                                Setujui RAB
                            </>
                        )}
                    </button>
                )
            case 'APPROVED':
                return (
                    <button
                        onClick={() => handleStatusTransition('PENGADAAN')}
                        disabled={isApproving}
                        className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                        <HiOutlineCalculator className="w-4 h-4" />
                        Mulai Pengadaan
                    </button>
                )
            case 'PENGADAAN':
                return (
                    <button
                        onClick={() => handleStatusTransition('PENGGELARAN_JARINGAN')}
                        disabled={isApproving}
                        className="px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                        <HiOutlineCube className="w-4 h-4" />
                        Mulai Penggelaran
                    </button>
                )
            case 'PENGGELARAN_JARINGAN':
                return (
                    <button
                        onClick={() => handleStatusTransition('PENJUALAN')}
                        disabled={isApproving}
                        className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                        <HiOutlineUsers className="w-4 h-4" />
                        Mulai Penjualan
                    </button>
                )
            default:
                return null
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Detail RAB Proyek"
            size="4xl"
        >
            <div className="space-y-6">
                {/* Header Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <HiOutlineDocumentText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Identitas Proyek</h3>
                            </div>

                            {/* ACTION BUTTONS */}
                            {renderActionButtons()}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 font-semibold mb-1">Nama Proyek</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-semibold mb-1">Status</p>
                                <span className={`px-2 py-1 ${getStatusBadge(data.status)} rounded text-xs font-bold uppercase`}>
                                    {data.status || 'DRAFT'}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
                                    <HiOutlineBuildingOffice className="w-4 h-4" /> Site / Group
                                </p>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {data.mixRadiusGroup?.name || data.site?.name || '-'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
                                    <HiOutlineCalendar className="w-4 h-4" /> Tanggal Mulai
                                </p>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {data.startDate ? new Date(data.startDate).toLocaleDateString('id-ID') : '-'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-semibold mb-1">Durasi Kontrak (Bulan)</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.investmentDurationMonths || 12}</p>
                            </div>

                            <div className="col-span-2 pt-4 border-t border-gray-100 dark:border-gray-700 mt-2">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                        <HiOutlineBanknotes className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Investor & Profit Sharing</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-gray-500 font-semibold mb-0.5">Komitmen Pengembalian Modal</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {data.investmentRecoveryType === 'PERCENTAGE' ? 'Persentase dari Profit' : 'Nilai Tetap per Bulan'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 font-semibold mb-0.5">
                                            {data.investmentRecoveryType === 'PERCENTAGE' ? 'Persen Pengembalian dari Profit (%)' : 'Nilai Pengembalian per Bulan (IDR)'}
                                        </p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {data.investmentRecoveryType === 'PERCENTAGE'
                                                ? `${data.investmentRecoveryValue}%`
                                                : formatCurrency(data.investmentRecoveryValue || 0)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 font-semibold mb-0.5">Toleransi NPL (%)</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.nplTolerancePercent || 0}%</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 font-semibold mb-0.5">Bagi Hasil Investor (%)</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.investorProfitSharePercent || 50}%</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 font-semibold mb-0.5">Bagi Hasil Perusahaan (%)</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{100 - (data.investorProfitSharePercent || 50)}%</p>
                                    </div>
                                </div>
                                <p className="mt-3 text-[10px] text-gray-500 italic leading-relaxed">
                                    * Seluruh modal (CAPEX) dianggap dari Investor. Angsuran modal (Recovery) akan diprioritaskan diambil dari profit kotor setiap bulan sebelum sisa profit dibagi antara Investor dan Perusahaan.
                                </p>
                            </div>

                            <div className="col-span-2 pt-2">
                                <p className="text-xs text-gray-500 font-semibold mb-1">Deskripsi Proyek</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 min-h-[60px]">
                                    {data.description || '-'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
                            <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                                <HiOutlineCalculator className="w-24 h-24" />
                            </div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-blue-100 mb-4">Financial Overview</h4>
                            <div className="space-y-3 relative z-10">
                                <div>
                                    <div className="text-[10px] text-blue-100 uppercase font-medium">Total Investasi (CAPEX + Contg.)</div>
                                    <div className="text-xl font-black">{formatCurrency(totalInvestment)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                    <div>
                                        <div className="text-[10px] text-blue-100 uppercase font-medium">CAPEX Dasar</div>
                                        <div className="text-sm font-bold">{formatCurrency(totalCapex)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-blue-100 uppercase font-medium">Contingency ({contingencyPercent}%)</div>
                                        <div className="text-sm font-bold">{formatCurrency(contingencyAmount)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-blue-100 uppercase font-medium">OPEX/Bln</div>
                                        <div className="text-sm font-bold">{formatCurrency(totalOpex)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-blue-100 uppercase font-medium">ROI (Saat Penuh)</div>
                                        <div className="text-sm font-bold">
                                            {roiPerYear.toFixed(1)}% / Tahun
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-blue-100 uppercase font-medium">Est. BEP Keseluruhan</div>
                                        <div className="text-sm font-bold">
                                            {bepMonth === Infinity ? '∞' : `${bepMonth} Bln`}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-blue-100 uppercase font-medium">BEP Pasca Target</div>
                                        <div className="text-sm font-bold" title={`Terhitung setelah kapasitas penuh di bulan ke-${monthsToFullCapacity}`}>
                                            {simpleBep === Infinity ? '∞' : `${simpleBep.toFixed(1)} Bln`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                                    <HiOutlineArrowTrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <h4 className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">Model Growth</h4>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                                    <span className="text-gray-500">Tipe Pertumbuhan</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{getGrowthTypeLabel(data.growthType)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                                    <span className="text-gray-500">Sistem Pembayaran</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                                        {data.paymentType === 'POSTPAID' ? 'Pascabayar (Postpaid)' : 'Prabayar (Prepaid)'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                                    <span className="text-gray-500">Target Pelanggan</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1">
                                        <HiOutlineUsers className="w-3.5 h-3.5" /> {data.targetSubscribers || 0}
                                    </span>
                                </div>
                                {data.growthType === 'LINEAR' && (
                                    <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                                        <span className="text-gray-500">Target Bulanan</span>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-right">
                                            +{(data.growthSettings as any)?.subscribersPerMonth || 0} <span className="text-xs font-normal text-gray-500">Pelanggan/Bulan</span>
                                        </span>
                                    </div>
                                )}
                                {data.growthType === 'PERCENTAGE' && (
                                    <div className="flex justify-between items-start text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                                        <span className="text-gray-500">Target Bulanan</span>
                                        <div className="font-semibold text-gray-900 dark:text-gray-100 flex flex-col items-end">
                                            <span>Awal: {(data.growthSettings as any)?.initialPercent || 0}%</span>
                                            <span className="text-xs text-emerald-600 dark:text-emerald-400">Naik {(data.growthSettings as any)?.monthlyGrowthPercent || 0}% / Bulan</span>
                                        </div>
                                    </div>
                                )}
                                {data.growthType === 'CUSTOM' && (
                                    <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                                        <span className="text-gray-500">Target Kustom</span>
                                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-right text-xs">
                                            Berdasarkan target spesifik tiap bulan
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-sm pb-1">
                                    <span className="text-gray-500">Max. Revenue / Bln</span>
                                    <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(projectedRevenue)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tracking Pencapaian */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <HiOutlineChartBar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Tracking Pencapaian (Realisasi)</h3>
                        </div>
                    </div>

                    <div className="p-0 overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Periode</th>
                                    <th scope="col" className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Revenue</th>
                                    <th scope="col" className="px-4 py-3 text-right text-[10px] font-bold text-red-500 uppercase">Potensi NPL</th>
                                    <th scope="col" className="px-4 py-3 text-right text-[10px] font-bold text-blue-600 uppercase">Profit Kotor</th>
                                    <th scope="col" className="px-4 py-3 text-right text-[10px] font-bold text-amber-600 uppercase">Angsuran Modal</th>
                                    <th scope="col" className="px-4 py-3 text-right text-[10px] font-bold text-orange-600 uppercase border-l border-gray-200 dark:border-gray-700">Sisa Investasi</th>
                                    <th scope="col" className="px-4 py-3 text-right text-[10px] font-bold text-indigo-600 uppercase">Investor Share</th>
                                    <th scope="col" className="px-4 py-3 text-right text-[10px] font-bold text-emerald-600 uppercase">Company Share</th>
                                    <th scope="col" className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {(() => {
                                    let currentBalance = totalCapex
                                    const recoveryType = data.investmentRecoveryType || 'PERCENTAGE'
                                    const recoveryValue = data.investmentRecoveryValue || 50
                                    const investorSharePercent = data.investorProfitSharePercent || 50

                                    return Array.from({ length: maxMonthsToShow }).map((_, i) => {
                                        const monthIndex = i + 1
                                        const isEditing = editingMonth === monthIndex

                                        const targetSubs = monthlySubsTargets[i] || 0
                                        const activeTargetSubs = data.paymentType === 'POSTPAID' ? (monthlySubsTargets[i - 1] || 0) : targetSubs
                                        const grossTargetRev = activeTargetSubs * arpu
                                        const targetRevenue = grossTargetRev * (1 - ((data.nplTolerancePercent || 0) / 100))

                                        const actualRecord = actuals.find(a => a.month === monthIndex)
                                        const isAutoAssumed = !actualRecord

                                        const displayRev = actualRecord ? Number(actualRecord.actualRevenue) : targetRevenue
                                        const grossProfit = displayRev - totalOpex

                                        // Recovery Calculation
                                        let recoveryInstallment = 0
                                        const hasManualRecovery = actualRecord?.manualRecoveryInstallment !== undefined && actualRecord?.manualRecoveryInstallment !== null

                                        if (hasManualRecovery) {
                                            recoveryInstallment = Number(actualRecord.manualRecoveryInstallment)
                                        } else if (currentBalance > 0 && grossProfit > 0) {
                                            if (recoveryType === 'PERCENTAGE') {
                                                recoveryInstallment = (recoveryValue / 100) * grossProfit
                                            } else {
                                                recoveryInstallment = recoveryValue
                                            }
                                            recoveryInstallment = Math.min(recoveryInstallment, currentBalance, grossProfit)
                                        }

                                        currentBalance -= recoveryInstallment
                                        const netProfit = Math.max(0, grossProfit - recoveryInstallment)

                                        const hasManualInvestor = actualRecord?.manualInvestorShare !== undefined && actualRecord?.manualInvestorShare !== null
                                        const hasManualCompany = actualRecord?.manualCompanyShare !== undefined && actualRecord?.manualCompanyShare !== null
                                        const hasManualPercent = actualRecord?.manualInvestorProfitSharePercent !== undefined && actualRecord?.manualInvestorProfitSharePercent !== null

                                        const currentInvestorPercent = hasManualPercent ? Number(actualRecord.manualInvestorProfitSharePercent) : investorSharePercent

                                        const investorShare = hasManualInvestor
                                            ? Number(actualRecord.manualInvestorShare)
                                            : ((currentInvestorPercent / 100) * netProfit)

                                        const companyShare = hasManualCompany
                                            ? Number(actualRecord.manualCompanyShare)
                                            : (netProfit - investorShare)

                                        return (
                                            <tr key={monthIndex} className={isAutoAssumed ? "bg-gray-50/30 dark:bg-gray-900/20" : "bg-emerald-50/20 dark:bg-emerald-900/10"}>
                                                <td className="px-4 py-3 whitespace-nowrap text-[11px] font-medium text-gray-900 dark:text-white">
                                                    Bln-{monthIndex}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right border-l border-gray-100 dark:border-gray-700/50">
                                                    {isEditing ? (
                                                        <div className="flex flex-col gap-1 items-end">
                                                            <input
                                                                type="number"
                                                                value={editForm.actualRevenue}
                                                                onChange={e => setEditForm({ ...editForm, actualRevenue: e.target.value })}
                                                                className="w-24 text-right text-[11px] border-blue-300 dark:border-blue-700 rounded bg-blue-50/50 dark:bg-blue-900/50"
                                                                placeholder="Rev"
                                                            />
                                                            <span className="text-[9px] text-gray-400">Target: {formatCurrency(targetRevenue)}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[11px] font-medium">{formatCurrency(displayRev)}</span>
                                                            <span className="text-[9px] text-gray-400">{actualRecord ? 'Aktual' : 'Proyeksi'}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-medium text-red-500">
                                                    {formatCurrency(grossTargetRev - targetRevenue)}
                                                    <div className="text-[9px] text-gray-400 font-normal">({data.nplTolerancePercent || 0}%)</div>
                                                </td>
                                                <td className={`px-4 py-3 whitespace-nowrap text-right text-[11px] font-medium ${grossProfit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                                    {formatCurrency(grossProfit)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-medium text-amber-600">
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            value={editForm.manualRecoveryInstallment}
                                                            onChange={e => setEditForm({ ...editForm, manualRecoveryInstallment: e.target.value })}
                                                            className="w-24 text-right text-[11px] border-amber-300 dark:border-amber-700 rounded bg-amber-50/50 dark:bg-amber-900/50"
                                                            placeholder="Manual"
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-end">
                                                            <span>{formatCurrency(recoveryInstallment)}</span>
                                                            {hasManualRecovery && <span className="text-[8px] text-amber-500 font-bold uppercase">Manual</span>}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-mono border-l border-gray-100 dark:border-gray-700/50">
                                                    <div className="flex flex-col items-end">
                                                        <span className={currentBalance <= 100 ? 'text-emerald-500 font-bold' : 'text-orange-600'}>
                                                            {formatCurrency(Math.max(0, currentBalance))}
                                                        </span>
                                                        {currentBalance <= 100 && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 rounded font-bold mt-0.5">BEP!</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-medium text-indigo-600">
                                                    {isEditing ? (
                                                        <div className="flex flex-col gap-1 items-end">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[9px] text-gray-400">%</span>
                                                                <input
                                                                    type="number"
                                                                    value={editForm.manualInvestorProfitSharePercent}
                                                                    onChange={e => setEditForm({ ...editForm, manualInvestorProfitSharePercent: e.target.value })}
                                                                    className="w-12 text-right text-[11px] border-indigo-200 dark:border-indigo-800 rounded bg-indigo-50/30"
                                                                    placeholder="%"
                                                                />
                                                            </div>
                                                            <input
                                                                type="number"
                                                                value={editForm.manualInvestorShare}
                                                                onChange={e => setEditForm({ ...editForm, manualInvestorShare: e.target.value })}
                                                                className="w-24 text-right text-[11px] border-indigo-300 dark:border-indigo-700 rounded bg-indigo-50/50 dark:bg-indigo-900/50"
                                                                placeholder="Amount"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-end">
                                                            <span>{formatCurrency(investorShare)}</span>
                                                            {hasManualPercent && <span className="text-[8px] text-indigo-400">{actualRecord.manualInvestorProfitSharePercent}% Share</span>}
                                                            {hasManualInvestor && <span className="text-[8px] text-indigo-500 font-bold uppercase">Manual Fixed</span>}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-medium text-emerald-600">
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            value={editForm.manualCompanyShare}
                                                            onChange={e => setEditForm({ ...editForm, manualCompanyShare: e.target.value })}
                                                            className="w-24 text-right text-[11px] border-emerald-300 dark:border-emerald-700 rounded bg-emerald-50/50 dark:bg-emerald-900/50"
                                                            placeholder="Amount"
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-end">
                                                            <span>{formatCurrency(companyShare)}</span>
                                                            {hasManualPercent && <span className="text-[8px] text-emerald-400">{100 - actualRecord.manualInvestorProfitSharePercent}% Share</span>}
                                                            {hasManualCompany && <span className="text-[8px] text-emerald-500 font-bold uppercase">Manual Fixed</span>}
                                                        </div>
                                                    )}
                                                </td>
                                                {/* Actions */}
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    {isEditing ? (
                                                        <div className="flex gap-2 justify-center">
                                                            <button onClick={() => setEditingMonth(null)} disabled={isSavingActual} className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                                                                <HiOutlineXMark className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleSaveActual(monthIndex)} disabled={isSavingActual} className="p-1 rounded text-white bg-blue-600 hover:bg-blue-700">
                                                                <HiOutlineCheck className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => handleEditClick(monthIndex, 0, displayRev)} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                                                            <HiOutlinePencilSquare className="w-3.5 h-3.5" /> Catat
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                })()}
                            </tbody>
                            <tfoot className="bg-gray-100 dark:bg-gray-900 font-bold border-t-2 border-gray-200 dark:border-gray-700">
                                {(() => {
                                    let runningBalance = totalCapex

                                    const totals = Array.from({ length: maxMonthsToShow }).reduce((acc: { rev: number; npl: number; gross: number; rec: number; inv: number; comp: number; lastBalance: number }, _, i) => {
                                        const monthIndex = i + 1
                                        const actualRecord = actuals.find(a => a.month === monthIndex)

                                        const targetSubs = monthlySubsTargets[i] || 0
                                        const activeTargetSubs = data.paymentType === 'POSTPAID' ? (monthlySubsTargets[i - 1] || 0) : targetSubs
                                        const grossTargetRev = activeTargetSubs * arpu
                                        const targetRevenue = grossTargetRev * (1 - ((data.nplTolerancePercent || 0) / 100))

                                        const displayRev = actualRecord ? Number(actualRecord.actualRevenue) : targetRevenue
                                        const nplAmount = grossTargetRev - targetRevenue;
                                        const grossProfit = displayRev - totalOpex

                                        // Recovery Calculation
                                        let recovery = 0
                                        const hasManualRec = actualRecord?.manualRecoveryInstallment !== undefined && actualRecord?.manualRecoveryInstallment !== null
                                        if (hasManualRec) {
                                            recovery = Number(actualRecord.manualRecoveryInstallment)
                                        } else if (runningBalance > 0 && grossProfit > 0) {
                                            const recType = data.investmentRecoveryType || 'PERCENTAGE'
                                            const recVal = data.investmentRecoveryValue || 0
                                            recovery = recType === 'PERCENTAGE' ? (recVal / 100) * grossProfit : recVal
                                            recovery = Math.min(recovery, runningBalance, grossProfit)
                                        }
                                        runningBalance -= recovery
                                        const netProfit = Math.max(0, grossProfit - recovery)

                                        const invPct = actualRecord?.manualInvestorProfitSharePercent ?? (data.investorProfitSharePercent || 50)
                                        const invShare = actualRecord?.manualInvestorShare !== undefined && actualRecord?.manualInvestorShare !== null
                                            ? Number(actualRecord.manualInvestorShare)
                                            : (invPct / 100) * netProfit

                                        const compShare = actualRecord?.manualCompanyShare !== undefined && actualRecord?.manualCompanyShare !== null
                                            ? Number(actualRecord.manualCompanyShare)
                                            : (netProfit - invShare)

                                        return {
                                            rev: acc.rev + displayRev,
                                            npl: acc.npl + nplAmount,
                                            gross: acc.gross + grossProfit,
                                            rec: acc.rec + recovery,
                                            inv: acc.inv + invShare,
                                            comp: acc.comp + compShare,
                                            lastBalance: runningBalance
                                        }
                                    }, { rev: 0, npl: 0, gross: 0, rec: 0, inv: 0, comp: 0, lastBalance: totalCapex })

                                    return (
                                        <tr className="bg-gray-100 dark:bg-gray-900 border-t-2 border-gray-300 dark:border-gray-600">
                                            <td className="px-4 py-4 text-[10px] text-gray-700 dark:text-gray-300 font-bold uppercase">TOTAL AKUMULASI</td>
                                            <td className="px-4 py-4 text-right text-[11px] text-gray-900 dark:text-white border-l border-gray-200/50">
                                                {formatCurrency(totals.rev)}
                                            </td>
                                            <td className="px-4 py-4 text-right text-[11px] text-red-500 font-bold">
                                                {formatCurrency(totals.npl)}
                                            </td>
                                            <td className="px-4 py-4 text-right text-[11px] text-blue-600 font-bold">
                                                {formatCurrency(totals.gross)}
                                            </td>
                                            <td className="px-4 py-4 text-right text-[11px] text-amber-600 font-bold">
                                                {formatCurrency(totals.rec)}
                                            </td>
                                            <td className="px-4 py-4 text-right text-[11px] text-orange-600 border-l border-gray-200/50">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold">{formatCurrency(Math.max(0, totals.lastBalance))}</span>
                                                    {totals.lastBalance <= 100 && <span className="text-[8px] text-emerald-500 font-bold uppercase">LUNAS</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right text-[11px] text-indigo-600 font-bold">
                                                <div className="flex flex-col items-end">
                                                    <span>{formatCurrency(totals.inv)}</span>
                                                    <span className="text-[8px] opacity-60 font-normal">Profit Share</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right text-[11px] text-emerald-600 font-bold">
                                                <div className="flex flex-col items-end">
                                                    <span>{formatCurrency(totals.comp)}</span>
                                                    <span className="text-[8px] opacity-60 font-normal">Profit Share</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4"></td>
                                        </tr>
                                    )
                                })()}
                            </tfoot>
                        </table>
                    </div>

                    {/* Enhanced Summary Cards */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                            Ringkasan Hak & Pembagian Keuntungan
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                        </h4>

                        {(() => {
                            let runningBalance = totalCapex

                            const totals = Array.from({ length: maxMonthsToShow }).reduce((acc: { rec: number; inv: number; comp: number }, _, i) => {
                                const mIdx = i + 1
                                const act = actuals.find(a => a.month === mIdx)
                                const targetSubs = monthlySubsTargets[i] || 0
                                const activeTargetSubs = data.paymentType === 'POSTPAID' ? (monthlySubsTargets[i - 1] || 0) : targetSubs
                                const rev = act ? Number(act.actualRevenue) : (activeTargetSubs * arpu)
                                const gross = rev - totalOpex

                                let r = 0
                                if (act?.manualRecoveryInstallment !== undefined && act?.manualRecoveryInstallment !== null) {
                                    r = Number(act.manualRecoveryInstallment)
                                } else if (runningBalance > 0 && gross > 0) {
                                    const recType = data.investmentRecoveryType || 'PERCENTAGE'
                                    const recVal = data.investmentRecoveryValue || 0
                                    r = recType === 'PERCENTAGE' ? (recVal / 100) * gross : recVal
                                    r = Math.min(r, runningBalance, gross)
                                }
                                runningBalance -= r
                                const net = Math.max(0, gross - r)

                                const invPct = act?.manualInvestorProfitSharePercent ?? (data.investorProfitSharePercent || 50)
                                const invS = act?.manualInvestorShare !== undefined && act?.manualInvestorShare !== null ? Number(act.manualInvestorShare) : (invPct / 100) * net
                                const compS = act?.manualCompanyShare !== undefined && act?.manualCompanyShare !== null ? Number(act.manualCompanyShare) : (net - invS)

                                return { rec: acc.rec + r, inv: acc.inv + invS, comp: acc.comp + compS }
                            }, { rec: 0, inv: 0, comp: 0 })

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Investor Side */}
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-indigo-100 dark:border-indigo-900/30 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <HiOutlineBanknotes className="w-16 h-16 text-indigo-600" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                                                    <HiOutlineUsers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <span className="text-sm font-bold text-gray-900 dark:text-white">HAK INVESTOR</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-500">Total Modal Kembali (CAPEX)</span>
                                                    <span className="font-semibold text-amber-600">{formatCurrency(totals.rec)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-500">Total Bagi Hasil Profit</span>
                                                    <span className="font-semibold text-indigo-600">{formatCurrency(totals.inv)}</span>
                                                </div>
                                                <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">TOTAL DITERIMA INVESTOR</span>
                                                    <span className="text-lg font-black text-indigo-600">{formatCurrency(totals.rec + totals.inv)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Company Side */}
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-emerald-100 dark:border-emerald-900/30 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <HiOutlineBuildingOffice className="w-16 h-16 text-emerald-600" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                                                    <HiOutlineBuildingOffice className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <span className="text-sm font-bold text-gray-900 dark:text-white">HAK PERUSAHAAN</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-500">Total Bagi Hasil Profit</span>
                                                    <span className="font-semibold text-emerald-600">{formatCurrency(totals.comp)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs invisible">
                                                    <span className="text-gray-500">-</span>
                                                    <span className="font-semibold">-</span>
                                                </div>
                                                <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">TOTAL DITERIMA PERUSAHAAN</span>
                                                    <span className="text-lg font-black text-emerald-600">{formatCurrency(totals.comp)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>

                {/* Items Lists */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                <HiOutlineCube className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Item & Biaya</h3>
                        </div>
                    </div>

                    <div className="p-0">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800/50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Item</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Harga Satuan</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {data.items.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                                                Tidak ada item pada RAB ini.
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {(() => {
                                                const hasWbs = data.wbsGroups && data.wbsGroups.length > 0
                                                if (!hasWbs) {
                                                    return data.items.map((item) => (
                                                        <React.Fragment key={item.id}>
                                                            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                                <td className="px-6 py-3 whitespace-nowrap text-sm">
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(!item.expenseType || item.expenseType === 'CAPEX')
                                                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                                        }`}>
                                                                        {item.expenseType || 'CAPEX'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-medium">{item.name}</td>
                                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                    {(() => {
                                                                        const cat = (item as any).expenseCategory;
                                                                        if (!cat) return item.category || '-';
                                                                        return cat.parent ? `${cat.parent.name} - ${cat.name}` : cat.name;
                                                                    })()}
                                                                </td>
                                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-medium">{item.quantity}</td>
                                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                                                                <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white text-right">{formatCurrency(Number(item.totalPrice))}</td>
                                                            </tr>
                                                            {item.disbursements && item.disbursements.length > 0 && (
                                                                <tr className="bg-indigo-50/30 dark:bg-indigo-900/10">
                                                                    <td colSpan={6} className="px-6 py-3">
                                                                        <div className="pl-6 border-l-2 border-indigo-300 dark:border-indigo-700">
                                                                            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">Termin Pencairan Vendor</p>
                                                                            <div className="overflow-x-auto">
                                                                                <table className="min-w-full divide-y divide-indigo-100 dark:divide-indigo-900/30">
                                                                                    <thead>
                                                                                        <tr>
                                                                                            <th className="py-2 text-left text-[9px] font-bold text-indigo-400 uppercase">Keterangan</th>
                                                                                            <th className="py-2 text-left text-[9px] font-bold text-indigo-400 uppercase">Est. Tanggal</th>
                                                                                            <th className="py-2 text-right text-[9px] font-bold text-indigo-400 uppercase">Persentase</th>
                                                                                            <th className="py-2 text-right text-[9px] font-bold text-indigo-400 uppercase">Nominal</th>
                                                                                            <th className="py-2 text-center text-[9px] font-bold text-indigo-400 uppercase">Status</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
                                                                                        {item.disbursements.map((d: any, idx: number) => (
                                                                                            <tr key={d.id}>
                                                                                                <td className="py-1.5 text-xs text-indigo-900 dark:text-indigo-300 font-medium">{d.name || `Termin ${idx + 1}`}</td>
                                                                                                <td className="py-1.5 text-xs text-indigo-500">{d.estimatedDate ? new Date(d.estimatedDate).toLocaleDateString('id-ID') : '-'}</td>
                                                                                                <td className="py-1.5 text-xs text-indigo-900 dark:text-indigo-300 text-right font-bold">{d.percentage}%</td>
                                                                                                <td className="py-1.5 text-xs text-indigo-700 dark:text-indigo-400 text-right font-mono font-medium">{formatCurrency(Number(d.amount))}</td>
                                                                                                <td className="py-1.5 text-center">
                                                                                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${d.isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                                                                                                        {d.isPaid ? 'Cair' : 'Menunggu'}
                                                                                                    </span>
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    ))
                                                }

                                                // Grouping by WBS
                                                const groups = [...(data.wbsGroups || [])].sort((a, b: any) => a.order - b.order)
                                                const ungrouppedItems = data.items.filter(i => !(i as any).wbsId && !i.wbsGroupId)

                                                return (
                                                    <React.Fragment>
                                                        {groups.map(wbs => {
                                                            const groupItems = data.items.filter(i => (i as any).wbsId === wbs.id || i.wbsGroupId === wbs.id)
                                                            if (groupItems.length === 0) return null

                                                            const groupSubtotal = groupItems.reduce((sum, item) => sum + Number(item.totalPrice), 0)
                                                            return (
                                                                <React.Fragment key={wbs.id}>
                                                                    <tr className="bg-gray-50/80 dark:bg-gray-900/40">
                                                                        <td colSpan={5} className="px-6 py-3 text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider border-l-4 border-indigo-500">
                                                                            {wbs.name}
                                                                        </td>
                                                                        <td className="px-6 py-3 text-right text-sm font-black text-indigo-700 dark:text-indigo-400">
                                                                            {formatCurrency(groupSubtotal)}
                                                                        </td>
                                                                    </tr>
                                                                    {groupItems.map(item => (
                                                                        <React.Fragment key={item.id}>
                                                                            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                                                <td className="px-6 py-2.5 whitespace-nowrap text-sm">
                                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(!item.expenseType || item.expenseType === 'CAPEX')
                                                                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                                                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                                                        }`}>
                                                                                        {item.expenseType || 'CAPEX'}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-6 py-2.5 text-sm text-gray-900 dark:text-white font-medium pl-8">{item.name}</td>
                                                                                <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                                    {(() => {
                                                                                        const cat = (item as any).expenseCategory;
                                                                                        if (!cat) return item.category || '-';
                                                                                        return cat.parent ? `${cat.parent.name} - ${cat.name}` : cat.name;
                                                                                    })()}
                                                                                </td>
                                                                                <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-medium">{item.quantity}</td>
                                                                                <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                                                                                <td className="px-6 py-2.5 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white text-right">{formatCurrency(Number(item.totalPrice))}</td>
                                                                            </tr>
                                                                            {item.disbursements && item.disbursements.length > 0 && (
                                                                                <tr className="bg-indigo-50/30 dark:bg-indigo-900/10">
                                                                                    <td colSpan={6} className="px-6 py-2">
                                                                                        <div className="pl-12 border-l-2 border-indigo-300 dark:border-indigo-700">
                                                                                            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">Termin Pencairan Vendor</p>
                                                                                            <div className="overflow-x-auto">
                                                                                                <table className="min-w-full divide-y divide-indigo-100 dark:divide-indigo-900/30">
                                                                                                    <thead>
                                                                                                        <tr>
                                                                                                            <th className="py-1 text-left text-[9px] font-bold text-indigo-400 uppercase">Keterangan</th>
                                                                                                            <th className="py-1 text-left text-[9px] font-bold text-indigo-400 uppercase">Est. Tanggal</th>
                                                                                                            <th className="py-1 text-right text-[9px] font-bold text-indigo-400 uppercase">Persentase</th>
                                                                                                            <th className="py-1 text-right text-[9px] font-bold text-indigo-400 uppercase">Nominal</th>
                                                                                                            <th className="py-1 text-center text-[9px] font-bold text-indigo-400 uppercase">Status</th>
                                                                                                        </tr>
                                                                                                    </thead>
                                                                                                    <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
                                                                                                        {item.disbursements.map((d: any, idx: number) => (
                                                                                                            <tr key={d.id}>
                                                                                                                <td className="py-1 text-[11px] text-indigo-900 dark:text-indigo-300 font-medium">{d.name || `Termin ${idx + 1}`}</td>
                                                                                                                <td className="py-1 text-[11px] text-indigo-500">{d.estimatedDate ? new Date(d.estimatedDate).toLocaleDateString('id-ID') : '-'}</td>
                                                                                                                <td className="py-1 text-[11px] text-indigo-900 dark:text-indigo-300 text-right font-bold">{d.percentage}%</td>
                                                                                                                <td className="py-1 text-[11px] text-indigo-700 dark:text-indigo-400 text-right font-mono font-medium">{formatCurrency(Number(d.amount))}</td>
                                                                                                                <td className="py-1 text-center">
                                                                                                                    <span className={`inline-flex px-1 py-0.5 rounded text-[8px] font-bold uppercase ${d.isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                                                                                                                        {d.isPaid ? 'Cair' : 'Menunggu'}
                                                                                                                    </span>
                                                                                                                </td>
                                                                                                            </tr>
                                                                                                        ))}
                                                                                                    </tbody>
                                                                                                </table>
                                                                                            </div>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                        </React.Fragment>
                                                                    ))}
                                                                </React.Fragment>
                                                            )
                                                        })}
                                                        {ungrouppedItems.length > 0 && (
                                                            <React.Fragment>
                                                                <tr className="bg-gray-50/80 dark:bg-gray-900/40">
                                                                    <td colSpan={5} className="px-6 py-3 text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider border-l-4 border-gray-400">
                                                                        Lain-lain (Belum Digrup)
                                                                    </td>
                                                                    <td className="px-6 py-3 text-right text-sm font-black text-gray-700 dark:text-gray-400">
                                                                        {formatCurrency(ungrouppedItems.reduce((sum, item) => sum + Number(item.totalPrice), 0))}
                                                                    </td>
                                                                </tr>
                                                                {ungrouppedItems.map(item => (
                                                                    <React.Fragment key={item.id}>
                                                                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                                            <td className="px-6 py-2.5 whitespace-nowrap text-sm">
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(!item.expenseType || item.expenseType === 'CAPEX')
                                                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                                                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                                                    }`}>
                                                                                    {item.expenseType || 'CAPEX'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-6 py-2.5 text-sm text-gray-900 dark:text-white font-medium pl-8">{item.name}</td>
                                                                            <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                                {(() => {
                                                                                    const cat = (item as any).expenseCategory;
                                                                                    if (!cat) return item.category || '-';
                                                                                    return cat.parent ? `${cat.parent.name} - ${cat.name}` : cat.name;
                                                                                })()}
                                                                            </td>
                                                                            <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-medium">{item.quantity}</td>
                                                                            <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                                                                            <td className="px-6 py-2.5 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white text-right">{formatCurrency(Number(item.totalPrice))}</td>
                                                                        </tr>
                                                                        {item.disbursements && item.disbursements.length > 0 && (
                                                                            <tr className="bg-indigo-50/30 dark:bg-indigo-900/10">
                                                                                <td colSpan={6} className="px-6 py-2">
                                                                                    <div className="pl-12 border-l-2 border-indigo-300 dark:border-indigo-700">
                                                                                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">Termin Pencairan Vendor</p>
                                                                                        <div className="overflow-x-auto">
                                                                                            <table className="min-w-full divide-y divide-indigo-100 dark:divide-indigo-900/30">
                                                                                                <thead>
                                                                                                    <tr>
                                                                                                        <th className="py-1 text-left text-[9px] font-bold text-indigo-400 uppercase">Keterangan</th>
                                                                                                        <th className="py-1 text-left text-[9px] font-bold text-indigo-400 uppercase">Est. Tanggal</th>
                                                                                                        <th className="py-1 text-right text-[9px] font-bold text-indigo-400 uppercase">Persentase</th>
                                                                                                        <th className="py-1 text-right text-[9px] font-bold text-indigo-400 uppercase">Nominal</th>
                                                                                                        <th className="py-1 text-center text-[9px] font-bold text-indigo-400 uppercase">Status</th>
                                                                                                    </tr>
                                                                                                </thead>
                                                                                                <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
                                                                                                    {item.disbursements.map((d: any, idx: number) => (
                                                                                                        <tr key={d.id}>
                                                                                                            <td className="py-1 text-[11px] text-indigo-900 dark:text-indigo-300 font-medium">{d.name || `Termin ${idx + 1}`}</td>
                                                                                                            <td className="py-1 text-[11px] text-indigo-500">{d.estimatedDate ? new Date(d.estimatedDate).toLocaleDateString('id-ID') : '-'}</td>
                                                                                                            <td className="py-1 text-[11px] text-indigo-900 dark:text-indigo-300 text-right font-bold">{d.percentage}%</td>
                                                                                                            <td className="py-1 text-[11px] text-indigo-700 dark:text-indigo-400 text-right font-mono font-medium">{formatCurrency(Number(d.amount))}</td>
                                                                                                            <td className="py-1 text-center">
                                                                                                                <span className={`inline-flex px-1 py-0.5 rounded text-[8px] font-bold uppercase ${d.isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                                                                                                                    {d.isPaid ? 'Cair' : 'Menunggu'}
                                                                                                                </span>
                                                                                                            </td>
                                                                                                        </tr>
                                                                                                    ))}
                                                                                                </tbody>
                                                                                            </table>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </React.Fragment>
                                                                ))}
                                                            </React.Fragment>
                                                        )}
                                                    </React.Fragment>
                                                )
                                            })()}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div >



                {/* APPROVER LIST SECTION */}
                {
                    data.approvals && data.approvals.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm overflow-hidden mt-6">
                            <div className="p-4 border-b border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/20 flex items-center gap-2">
                                <HiOutlineCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 p-0.5" />
                                <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">Status Persetujuan</h3>
                            </div>
                            <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex gap-4">
                                    {data.approvals.map((approval) => (
                                        <div key={approval.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 min-w-[200px]">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold uppercase shrink-0">
                                                {approval.user.name?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{approval.user.name}</p>
                                                <p className="text-[10px] text-gray-500 font-medium uppercase">{approval.user.role?.name || 'Authorized'}</p>
                                                <p className="text-[9px] text-emerald-600 mt-0.5">Disetujui pada {new Date(approval.createdAt).toLocaleDateString('id-ID')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {data.status === 'APPROVED' && (
                                    <div className="text-right">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-bold uppercase">
                                            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></div>
                                            RAB Telah Disahkan
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }
            </div >

            <div className="mt-8 flex justify-end">
                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-xl transition-colors"
                >
                    Tutup
                </button>
            </div>
        </Modal >
    )
}
