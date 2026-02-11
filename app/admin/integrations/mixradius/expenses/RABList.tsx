'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    HiOutlinePencilSquare,
    HiOutlineTrash,
    HiOutlineCalculator,
    HiOutlineBuildingOffice,
    HiOutlineArrowTrendingUp,
    HiOutlineUsers
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import { formatCurrency } from '@/lib/utils'
import { usePermission } from '@/hooks/use-permission'

interface RABItem {
    id: string
    name: string
    category: string
    quantity: number
    unitPrice: number
    totalPrice: number
    expenseType?: 'CAPEX' | 'OPEX'
}

interface LinearGrowthSettings {
    subscribersPerMonth: number
}

interface PercentageGrowthSettings {
    initialPercent: number
    monthlyGrowthPercent: number
}

interface CustomMilestone {
    month: number
    percent: number
}

interface CustomGrowthSettings {
    milestones: CustomMilestone[]
}

type GrowthSettings = LinearGrowthSettings | PercentageGrowthSettings | CustomGrowthSettings

export interface RABProject {
    id: string
    name: string
    description?: string
    siteId?: string
    mixRadiusGroupId?: string
    site?: { name: string }
    mixRadiusGroup?: { name: string }
    projectedRevenue: number
    projectedOpex: number
    targetSubscribers?: number
    arpu?: number
    growthType?: 'LINEAR' | 'PERCENTAGE' | 'CUSTOM'
    growthSettings?: GrowthSettings
    startDate?: string
    status: string
    items: RABItem[]
    createdAt: string
    updatedAt: string
}

interface RABListProps {
    onEdit: (project: RABProject) => void
    refreshKey?: number
}

// Calculate realistic BEP considering growth period
function calculateRealisticBEP(project: RABProject): { bepMonth: number; simpleBep: number } {
    const totalCapex = project.items
        .filter(item => !item.expenseType || item.expenseType === 'CAPEX')
        .reduce((sum, item) => sum + Number(item.totalPrice), 0)

    const monthlyOpex = Number(project.projectedOpex)
    const arpu = Number(project.arpu) || 0
    const targetSubscribers = project.targetSubscribers || 0
    const growthType = project.growthType || 'LINEAR'
    const growthSettings = project.growthSettings

    // Simple BEP (old calculation)
    const fullRevenue = Number(project.projectedRevenue)
    const simpleProfit = fullRevenue - monthlyOpex
    const simpleBep = simpleProfit > 0 ? totalCapex / simpleProfit : Infinity

    if (!targetSubscribers || !arpu || !growthSettings) {
        return { bepMonth: Infinity, simpleBep }
    }

    // Realistic BEP with growth
    const maxMonths = 120
    let cumulativeProfit = 0
    let bepMonth = Infinity

    for (let month = 1; month <= maxMonths; month++) {
        let subs = 0

        if (growthType === 'LINEAR') {
            const settings = growthSettings as LinearGrowthSettings
            subs = Math.min(settings.subscribersPerMonth * month, targetSubscribers)
        } else if (growthType === 'PERCENTAGE') {
            const settings = growthSettings as PercentageGrowthSettings
            const initialSubs = (settings.initialPercent / 100) * targetSubscribers
            if (month === 1) {
                subs = initialSubs
            } else {
                const addPerMonth = (settings.monthlyGrowthPercent / 100) * targetSubscribers
                subs = Math.min(initialSubs + (addPerMonth * (month - 1)), targetSubscribers)
            }
        } else if (growthType === 'CUSTOM') {
            const settings = growthSettings as CustomGrowthSettings
            const sortedMilestones = [...settings.milestones].sort((a, b) => a.month - b.month)
            let prevMilestone = { month: 0, percent: 0 }
            let nextMilestone = sortedMilestones[sortedMilestones.length - 1] || { month: 1, percent: 100 }

            for (const m of sortedMilestones) {
                if (m.month <= month) prevMilestone = m
                if (m.month >= month && m.month < nextMilestone.month) nextMilestone = m
            }

            if (prevMilestone.month === month) {
                subs = (prevMilestone.percent / 100) * targetSubscribers
            } else if (nextMilestone.month === month) {
                subs = (nextMilestone.percent / 100) * targetSubscribers
            } else {
                const range = nextMilestone.month - prevMilestone.month
                const progress = (month - prevMilestone.month) / range
                const percentAtMonth = prevMilestone.percent + (nextMilestone.percent - prevMilestone.percent) * progress
                subs = (percentAtMonth / 100) * targetSubscribers
            }
        }

        const revenue = Math.round(subs) * arpu
        const profit = revenue - monthlyOpex
        cumulativeProfit += profit

        if (cumulativeProfit >= totalCapex && bepMonth === Infinity) {
            bepMonth = month
        }
    }

    return { bepMonth, simpleBep }
}

export default function RABList({ onEdit, refreshKey }: RABListProps) {
    const { hasPermission } = usePermission()
    const canUpdate = hasPermission('mixradius_expenses:update') || hasPermission('expense:update')
    const canDelete = hasPermission('mixradius_expenses:delete') || hasPermission('expense:delete')

    const [data, setData] = useState<RABProject[]>([])
    const [loading, setLoading] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/finance/rab-projects')
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                console.error('RAB fetch error:', res.status, errorData)
                throw new Error(errorData.error || `Gagal mengambil data RAB (status: ${res.status})`)
            }
            const json = await res.json()
            setData(json)
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : 'Gagal mengambil data RAB')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData, refreshKey])

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah anda yakin ingin menghapus RAB ini?')) return

        try {
            const res = await fetch(`/api/finance/rab-projects/${id}`, {
                method: 'DELETE'
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || 'Gagal menghapus RAB')
            }
            toast.success('RAB berhasil dihapus')
            fetchData()
        } catch (_error) {
            toast.error('Gagal menghapus RAB')
        }
    }

    const calculateTotalCapex = (project: RABProject) => {
        return project.items
            .filter(item => !item.expenseType || item.expenseType === 'CAPEX')
            .reduce((sum, item) => sum + Number(item.totalPrice), 0)
    }

    const getGrowthTypeLabel = (type?: string) => {
        switch (type) {
            case 'LINEAR': return 'Linear'
            case 'PERCENTAGE': return 'Persentase'
            case 'CUSTOM': return 'Kustom'
            default: return '-'
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
             <ResponsiveTable keyField="id"
                data={data}
                loading={loading}
                emptyMessage={
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                        <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-full mb-3">
                            <HiOutlineCalculator className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-lg font-medium">Belum ada data RAB</p>
                        <p className="text-sm mt-1">Buat RAB baru untuk memulai perencanaan proyek</p>
                    </div>
                }
                columns={[
                    {
                        key: 'name',
                        header: 'Nama Proyek',
                        render: (item) => (
                            <div>
                                <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{item.description}</div>
                            </div>
                        )
                    },
                    {
                        key: 'site',
                        header: 'Site / Group',
                        render: (item) => {
                            const name = item.mixRadiusGroup?.name || item.site?.name
                            return name ? (
                                <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                    <HiOutlineBuildingOffice className="w-4 h-4 text-gray-400" />
                                    {name}
                                </div>
                            ) : (
                                <span className="text-gray-400 italic text-sm">-</span>
                            )
                        }
                    },
                    {
                        key: 'target',
                        header: 'Target',
                        render: (item) => (
                            <div className="flex items-center gap-1.5 text-sm">
                                <HiOutlineUsers className="w-4 h-4 text-indigo-400" />
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {item.targetSubscribers || '-'}
                                </span>
                            </div>
                        )
                    },
                    {
                        key: 'growthType',
                        header: 'Model Growth',
                        render: (item) => (
                            <div className="flex items-center gap-1.5">
                                <HiOutlineArrowTrendingUp className="w-4 h-4 text-purple-400" />
                                <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded">
                                    {getGrowthTypeLabel(item.growthType)}
                                </span>
                            </div>
                        )
                    },
                    {
                        key: 'totalCapex',
                        header: 'Total CAPEX',
                        render: (item) => (
                            <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                                {formatCurrency(calculateTotalCapex(item))}
                            </span>
                        )
                    },
                    {
                        key: 'bep',
                        header: 'Est. BEP',
                        render: (item) => {
                            const { bepMonth, simpleBep } = calculateRealisticBEP(item)
                            const hasGrowth = item.targetSubscribers && item.arpu && item.growthSettings

                            return (
                                <div className="space-y-1">
                                    <div className={`font-bold px-2 py-1 rounded-md text-xs inline-flex items-center gap-1 ${
                                        bepMonth === Infinity
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                            : bepMonth <= 24
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                    }`}>
                                        {bepMonth === Infinity ? '∞' : `${bepMonth} Bulan`}
                                        {hasGrowth && <HiOutlineArrowTrendingUp className="w-3 h-3" />}
                                    </div>
                                    {hasGrowth && simpleBep !== Infinity && (
                                        <div className="text-[10px] text-gray-400">
                                            Sederhana: {simpleBep.toFixed(1)} bln
                                        </div>
                                    )}
                                </div>
                            )
                        }
                    },
                    {
                        key: 'status',
                        header: 'Status',
                        render: (item) => (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded text-xs font-medium uppercase">
                                {item.status || 'DRAFT'}
                            </span>
                        )
                    },
                    ...((canUpdate || canDelete) ? [{
                        key: 'actions',
                        header: '',
                        render: (item: RABProject) => (
                            <div className="flex justify-end gap-2">
                                {canUpdate && (
                                    <button
                                        onClick={() => onEdit(item)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                        title="Edit"
                                    >
                                        <HiOutlinePencilSquare className="w-5 h-5" />
                                    </button>
                                )}
                                {canDelete && (
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        title="Hapus"
                                    >
                                        <HiOutlineTrash className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        )
                    }] : [])
                ]}
            />
        </div>
    )
}
