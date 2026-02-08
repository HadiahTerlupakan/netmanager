'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
    HiOutlinePencilSquare, 
    HiOutlineTrash, 
    HiOutlineCalculator,
    HiOutlineBuildingOffice
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
    status: string
    items: RABItem[]
    createdAt: string
    updatedAt: string
}

interface RABListProps {
    onEdit: (project: RABProject) => void
    refreshKey?: number
}

export default function RABList({ onEdit, refreshKey }: RABListProps) {
    const { hasPermission } = usePermission()
    const canUpdate = hasPermission('mixradius_expenses:update') || hasPermission('expense:update') // Assuming same permissions for now
    const canDelete = hasPermission('mixradius_expenses:delete') || hasPermission('expense:delete')

    const [data, setData] = useState<RABProject[]>([])
    const [loading, setLoading] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/finance/rab-projects')
            if (!res.ok) throw new Error('Failed to fetch RAB projects')
            const json = await res.json()
            setData(json)
        } catch (error) {
            console.error(error)
            toast.error('Gagal mengambil data RAB')
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
            if (!res.ok) throw new Error('Gagal menghapus')
            toast.success('RAB berhasil dihapus')
            fetchData()
        } catch (error) {
            toast.error('Gagal menghapus RAB')
        }
    }

    const calculateTotalCapex = (project: RABProject) => {
        return project.items
            .filter(item => !item.expenseType || item.expenseType === 'CAPEX')
            .reduce((sum, item) => sum + Number(item.totalPrice), 0)
    }

    const calculateBEP = (project: RABProject) => {
        const totalCapex = calculateTotalCapex(project)
        const profit = Number(project.projectedRevenue) - Number(project.projectedOpex)
        
        if (profit <= 0) return 'Infinity'
        
        const months = totalCapex / profit
        return `${months.toFixed(1)} Bulan`
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
                        key: 'totalCapex',
                        header: 'Total CAPEX',
                        render: (item) => (
                            <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                                {formatCurrency(calculateTotalCapex(item))}
                            </span>
                        )
                    },
                    {
                        key: 'projectedRevenue',
                        header: 'Est. Revenue/bln',
                        render: (item) => (
                            <span className="font-mono text-gray-700 dark:text-gray-300">
                                {formatCurrency(item.projectedRevenue)}
                            </span>
                        )
                    },
                    {
                        key: 'projectedOpex',
                        header: 'Est. OPEX/bln',
                        render: (item) => (
                            <span className="font-mono text-orange-600 dark:text-orange-400">
                                {formatCurrency(item.projectedOpex)}
                            </span>
                        )
                    },
                    {
                        key: 'bep',
                        header: 'Est. BEP',
                        render: (item) => {
                            const bep = calculateBEP(item)
                            return (
                                <span className={`font-bold px-2 py-1 rounded-md text-xs ${
                                    bep === 'Infinity' 
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                }`}>
                                    {bep}
                                </span>
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
