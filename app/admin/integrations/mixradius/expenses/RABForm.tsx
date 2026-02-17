'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlineCalculator,
    HiOutlineCheck,
    HiOutlineCurrencyDollar,
    HiOutlineBuildingOffice,
    HiOutlineDocumentText,
    HiOutlineCube,
    HiOutlineUsers,
    HiOutlineBanknotes,
    HiOutlineArrowTrendingUp,
    HiOutlineCalendar,
    HiOutlineChartBar
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import type { RABProject } from './RABList'
import { Modal } from '@/components/ui/Modal'

interface SiteOption {
    id: string
    name: string
    siteId?: string
}

interface RABFormProps {
    isOpen: boolean
    initialData?: RABProject | null
    sites: SiteOption[]
    onSaved: () => void
    onClose: () => void
}

// Helper component for currency input
const CurrencyInput = ({
    label,
    value,
    onChange,
    placeholder,
    readOnly = false,
    helperText
}: {
    label: string,
    value: number,
    onChange?: (val: number) => void,
    placeholder?: string,
    readOnly?: boolean,
    helperText?: string
}) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm font-medium">Rp</span>
            </div>
            <input
                type="number"
                min="0"
                value={value || ''}
                onChange={(e) => onChange && onChange(Number(e.target.value))}
                readOnly={readOnly}
                className={`block w-full pl-10 pr-12 py-2.5 sm:text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white transition-shadow group-hover:shadow-sm ${readOnly ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed text-gray-500 dark:text-gray-400' : 'text-gray-900'}`}
                placeholder={placeholder || "0"}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-400 sm:text-xs">IDR</span>
            </div>
        </div>
        {(value > 0 || helperText) && (
            <div className="flex justify-between mt-1">
                {helperText && <span className="text-xs text-gray-500 italic">{helperText}</span>}
                {value > 0 && (
                    <p className="text-xs text-gray-500 font-mono text-right ml-auto">
                        {formatCurrency(value)}
                    </p>
                )}
            </div>
        )}
    </div>
)

type MainTab = 'info' | 'growth' | 'items'
type ExpenseType = 'CAPEX' | 'OPEX'
type GrowthType = 'LINEAR' | 'PERCENTAGE' | 'CUSTOM'

interface LocalItem {
    id: string
    name: string
    category: string
    quantity: number
    unitPrice: number
    expenseType: ExpenseType
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

// Helper to calculate subscribers for each month based on growth type
function calculateMonthlySubscribers(
    targetSubscribers: number,
    growthType: GrowthType,
    growthSettings: GrowthSettings | null,
    months: number
): number[] {
    const result: number[] = []
    if (!growthSettings) return result

    for (let month = 1; month <= months; month++) {
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
                const progress = range > 0 ? (month - prevMilestone.month) / range : 0
                const percentAtMonth = prevMilestone.percent + (nextMilestone.percent - prevMilestone.percent) * progress
                subs = (percentAtMonth / 100) * targetSubscribers
            }
        }

        result.push(Math.round(subs))
    }

    return result
}

// Calculate realistic BEP with growth period
function calculateRealisticBEP(
    totalCapex: number,
    monthlyOpex: number,
    arpu: number,
    targetSubscribers: number,
    growthType: GrowthType,
    growthSettings: GrowthSettings | null
): number {
    if (!targetSubscribers || !arpu || !growthSettings) {
        return Infinity
    }

    const maxMonths = 120
    const monthlySubscribers = calculateMonthlySubscribers(targetSubscribers, growthType, growthSettings, maxMonths)

    let cumulativeProfit = 0

    for (let month = 0; month < maxMonths; month++) {
        const subs = monthlySubscribers[month] || 0
        const revenue = subs * arpu
        const profit = revenue - monthlyOpex
        cumulativeProfit += profit

        if (cumulativeProfit >= totalCapex) {
            return month + 1
        }
    }

    return Infinity
}

export default function RABForm({ isOpen, initialData, sites, onSaved, onClose }: RABFormProps) {
    const [mainTab, setMainTab] = useState<MainTab>('info')
    const [expenseTab, setExpenseTab] = useState<ExpenseType>('CAPEX')

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        mixRadiusGroupId: '',
        siteId: '',
        status: 'DRAFT',
        startDate: ''
    })

    // Target & Revenue state
    const [targetSubscribers, setTargetSubscribers] = useState(0)
    const [arpu, setArpu] = useState(0)

    // Growth period state
    const [growthType, setGrowthType] = useState<GrowthType>('LINEAR')
    const [linearSettings, setLinearSettings] = useState<LinearGrowthSettings>({ subscribersPerMonth: 10 })
    const [percentageSettings, setPercentageSettings] = useState<PercentageGrowthSettings>({
        initialPercent: 10,
        monthlyGrowthPercent: 15
    })
    const [customMilestones, setCustomMilestones] = useState<CustomMilestone[]>([
        { month: 3, percent: 30 },
        { month: 6, percent: 60 },
        { month: 12, percent: 100 }
    ])

    const [items, setItems] = useState<LocalItem[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Get current growth settings based on type
    const currentGrowthSettings = useMemo((): GrowthSettings => {
        switch (growthType) {
            case 'LINEAR':
                return linearSettings
            case 'PERCENTAGE':
                return percentageSettings
            case 'CUSTOM':
                return { milestones: customMilestones }
        }
    }, [growthType, linearSettings, percentageSettings, customMilestones])

    // Initialize data if editing when modal opens
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name,
                    description: initialData.description || '',
                    mixRadiusGroupId: initialData.mixRadiusGroupId || '',
                    siteId: initialData.siteId || '',
                    status: initialData.status,
                    startDate: initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : ''
                })

                // Load target & arpu
                if (initialData.targetSubscribers) setTargetSubscribers(initialData.targetSubscribers)
                if (initialData.arpu) setArpu(Number(initialData.arpu))

                // Load growth settings
                if (initialData.growthType) setGrowthType(initialData.growthType as GrowthType)
                if (initialData.growthSettings) {
                    const settings = initialData.growthSettings as GrowthSettings
                    if ('subscribersPerMonth' in settings) {
                        setLinearSettings(settings as LinearGrowthSettings)
                    } else if ('initialPercent' in settings) {
                        setPercentageSettings(settings as PercentageGrowthSettings)
                    } else if ('milestones' in settings) {
                        setCustomMilestones((settings as CustomGrowthSettings).milestones)
                    }
                }

                // Load items
                setItems(initialData.items.map(item => ({
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    expenseType: item.expenseType || 'CAPEX'
                })))
            } else {
                // Reset form
                setFormData({
                    name: '',
                    description: '',
                    mixRadiusGroupId: '',
                    siteId: '',
                    status: 'DRAFT',
                    startDate: ''
                })
                setTargetSubscribers(0)
                setArpu(0)
                setGrowthType('LINEAR')
                setLinearSettings({ subscribersPerMonth: 10 })
                setPercentageSettings({ initialPercent: 10, monthlyGrowthPercent: 15 })
                setCustomMilestones([
                    { month: 3, percent: 30 },
                    { month: 6, percent: 60 },
                    { month: 12, percent: 100 }
                ])
                setItems([
                    { id: crypto.randomUUID(), name: '', category: 'DEVICE', quantity: 1, unitPrice: 0, expenseType: 'CAPEX' }
                ])
            }
            setMainTab('info')
            setExpenseTab('CAPEX')
        }
    }, [initialData, isOpen])

    const handleAddItem = () => {
        setItems([...items, {
            id: crypto.randomUUID(),
            name: '',
            category: expenseTab === 'CAPEX' ? 'DEVICE' : 'OPERATIONAL',
            quantity: 1,
            unitPrice: 0,
            expenseType: expenseTab
        }])
    }

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id))
    }

    const updateItem = (id: string, field: string, value: string | number) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    const handleAddMilestone = () => {
        const lastMonth = customMilestones.length > 0
            ? Math.max(...customMilestones.map(m => m.month))
            : 0
        setCustomMilestones([...customMilestones, { month: lastMonth + 3, percent: 100 }])
    }

    const handleRemoveMilestone = (index: number) => {
        setCustomMilestones(customMilestones.filter((_, i) => i !== index))
    }

    const updateMilestone = (index: number, field: 'month' | 'percent', value: number) => {
        setCustomMilestones(customMilestones.map((m, i) =>
            i === index ? { ...m, [field]: value } : m
        ))
    }

    // Calculations
    const capexItems = items.filter(i => i.expenseType === 'CAPEX')
    const opexItems = items.filter(i => i.expenseType === 'OPEX')

    const totalCapex = capexItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const totalOpex = opexItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)

    // Projected revenue at full capacity
    const projectedRevenue = targetSubscribers * arpu

    // Profit Calculation (simple - at full capacity)
    const profitPerMonth = projectedRevenue - totalOpex
    const simpleBepMonths = profitPerMonth > 0 ? totalCapex / profitPerMonth : Infinity
    const margin = projectedRevenue > 0 ? (profitPerMonth / projectedRevenue) * 100 : 0

    // Realistic BEP with growth
    const realisticBepMonths = useMemo(() => {
        return calculateRealisticBEP(
            totalCapex,
            totalOpex,
            arpu,
            targetSubscribers,
            growthType,
            currentGrowthSettings
        )
    }, [totalCapex, totalOpex, arpu, targetSubscribers, growthType, currentGrowthSettings])

    // Months to reach full capacity
    const monthsToFullCapacity = useMemo(() => {
        if (!targetSubscribers || !currentGrowthSettings) return 0
        const subs = calculateMonthlySubscribers(targetSubscribers, growthType, currentGrowthSettings, 120)
        const idx = subs.findIndex(s => s >= targetSubscribers)
        return idx >= 0 ? idx + 1 : 120
    }, [targetSubscribers, growthType, currentGrowthSettings])

    // Preview chart data (24 months)
    const previewSubscribers = useMemo(() => {
        return calculateMonthlySubscribers(targetSubscribers, growthType, currentGrowthSettings, 24)
    }, [targetSubscribers, growthType, currentGrowthSettings])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Comprehensive validation with clear messages
        const validationErrors: string[] = []

        if (!formData.name.trim()) {
            validationErrors.push('Nama proyek wajib diisi')
        }
        if (items.length === 0) {
            validationErrors.push('Minimal 1 item biaya harus ditambahkan')
        }
        const emptyItems = items.filter(i => !i.name.trim())
        if (emptyItems.length > 0) {
            validationErrors.push(`${emptyItems.length} item belum diisi namanya`)
        }
        const zeroItems = items.filter(i => i.unitPrice <= 0)
        if (zeroItems.length > 0) {
            validationErrors.push(`${zeroItems.length} item memiliki harga Rp 0`)
        }

        if (validationErrors.length > 0) {
            toast.error(
                `Mohon perbaiki data berikut:\n${validationErrors.map(e => `- ${e}`).join('\n')}`,
                { duration: 6000 }
            )
            if (!formData.name.trim()) setMainTab('info')
            else if (items.length === 0 || emptyItems.length > 0 || zeroItems.length > 0) setMainTab('items')
            return
        }

        setIsSubmitting(true)

        try {
            let finalSiteId = formData.siteId
            const selectedGroup = sites.find(s => s.id === formData.mixRadiusGroupId)
            if (selectedGroup && selectedGroup.siteId) {
                finalSiteId = selectedGroup.siteId
            }

            const payload = {
                name: formData.name,
                description: formData.description,
                mixRadiusGroupId: formData.mixRadiusGroupId || undefined,
                siteId: finalSiteId || undefined,
                projectedRevenue: projectedRevenue,
                projectedOpex: totalOpex,
                targetSubscribers,
                arpu,
                growthType,
                growthSettings: currentGrowthSettings,
                startDate: formData.startDate || undefined,
                items: items.map(({ id: _id, ...rest }) => rest)
            }

            const url = initialData
                ? `/api/finance/rab-projects/${initialData.id}`
                : '/api/finance/rab-projects'

            const method = initialData ? 'PATCH' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.error || 'Gagal menyimpan RAB')
            }

            toast.success(initialData ? 'RAB diperbarui' : 'RAB dibuat')
            onSaved()
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : 'Terjadi kesalahan')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Render items for current expense tab
    const currentTabItems = expenseTab === 'CAPEX' ? capexItems : opexItems

    // Main tab configuration
    const mainTabs = [
        { id: 'info' as MainTab, label: 'Informasi Proyek', icon: HiOutlineDocumentText },
        { id: 'growth' as MainTab, label: 'Periode Pertumbuhan', icon: HiOutlineArrowTrendingUp },
        { id: 'items' as MainTab, label: 'Item & Biaya', icon: HiOutlineCube }
    ]

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? 'Edit RAB Proyek' : 'Buat RAB Proyek Baru'}
            size="4xl"
        >
            <form onSubmit={handleSubmit} className="animate-in fade-in duration-300">
                {/* Main Tab Headers */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 -mt-2">
                    {mainTabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setMainTab(tab.id)}
                            className={`flex-1 py-3 px-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
                                mainTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">
                                {tab.id === 'info' && 'Info'}
                                {tab.id === 'growth' && 'Growth'}
                                {tab.id === 'items' && 'Item'}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="min-h-[400px]">
                    {/* Tab 1: Informasi Proyek */}
                    {mainTab === 'info' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-200">
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-4">
                                    <HiOutlineDocumentText className="w-5 h-5 text-blue-500" />
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Data Proyek</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            Nama Proyek <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                             className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500 py-2.5 dark:text-white dark:placeholder-gray-400"
                                             placeholder="Contoh: Ekspansi Cluster A - 2024"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Lokasi / Site (Group)</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <HiOutlineBuildingOffice className="text-gray-400 w-4 h-4" />
                                            </div>
                                            <select
                                                value={formData.mixRadiusGroupId}
                                                 onChange={e => setFormData({...formData, mixRadiusGroupId: e.target.value})}
                                                 className="block w-full pl-9 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-2.5 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                                            >
                                                 <option value="" className="dark:text-gray-400">-- Pilih Lokasi --</option>
                                                {sites.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tanggal Mulai</label>
                                        <div className="relative">
                                            <HiOutlineCalendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                            <input
                                                type="date"
                                                 value={formData.startDate}
                                                 onChange={e => setFormData({...formData, startDate: e.target.value})}
                                                 className="block w-full pl-9 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-2.5 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Deskripsi / Catatan</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={e => setFormData({...formData, description: e.target.value})}
                                             className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white dark:placeholder-gray-400"
                                             rows={3}
                                             placeholder="Deskripsi singkat mengenai proyek ini..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Quick Summary */}
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Target</div>
                                        <div className="text-lg font-bold text-gray-900 dark:text-white">{targetSubscribers || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">CAPEX</div>
                                        <div className="text-lg font-bold text-purple-600">{formatCurrency(totalCapex)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">OPEX/bln</div>
                                        <div className="text-lg font-bold text-orange-600">{formatCurrency(totalOpex)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Est. BEP</div>
                                        <div className={`text-lg font-bold ${realisticBepMonths <= 24 ? 'text-green-600' : 'text-red-600'}`}>
                                            {realisticBepMonths === Infinity ? '∞' : `${realisticBepMonths} bln`}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Next Button */}
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setMainTab('growth')}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                >
                                    Lanjut ke Periode Pertumbuhan
                                    <HiOutlineArrowTrendingUp className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Periode Pertumbuhan */}
                    {mainTab === 'growth' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-200">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Inputs */}
                                <div className="space-y-5">
                                    {/* Target & ARPU */}
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-4">
                                            <HiOutlineUsers className="w-5 h-5 text-indigo-500" />
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Target & Revenue</h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Target Pelanggan</label>
                                                <div className="relative">
                                                    <HiOutlineUsers className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={targetSubscribers || ''}
                                                        onChange={e => setTargetSubscribers(Number(e.target.value))}
                                                        className="block w-full pl-9 pr-4 py-2.5 text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800"
                                                        placeholder="100"
                                                    />
                                                </div>
                                            </div>
                                            <CurrencyInput
                                                label="ARPU (Harga/bln)"
                                                value={arpu}
                                                onChange={setArpu}
                                                placeholder="150000"
                                            />
                                        </div>

                                        {projectedRevenue > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">Est. Pendapatan (Full Capacity):</span>
                                                <span className="font-bold text-green-600 font-mono">{formatCurrency(projectedRevenue)}/bln</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Growth Type */}
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-4">
                                            <HiOutlineArrowTrendingUp className="w-5 h-5 text-indigo-500" />
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Model Pertumbuhan</h3>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 mb-4">
                                            {(['LINEAR', 'PERCENTAGE', 'CUSTOM'] as GrowthType[]).map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setGrowthType(type)}
                                                    className={`py-2.5 px-3 text-xs font-bold rounded-lg border transition-all ${
                                                        growthType === type
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                                                    }`}
                                                >
                                                    {type === 'LINEAR' && 'Linear'}
                                                    {type === 'PERCENTAGE' && 'Persentase'}
                                                    {type === 'CUSTOM' && 'Kustom'}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Growth Settings */}
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                            {growthType === 'LINEAR' && (
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                                                        Pelanggan Baru per Bulan
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={linearSettings.subscribersPerMonth}
                                                        onChange={e => setLinearSettings({ subscribersPerMonth: Number(e.target.value) })}
                                                        className="block w-full py-2.5 px-3 text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        Target {targetSubscribers} pelanggan tercapai dalam ±{linearSettings.subscribersPerMonth > 0 ? Math.ceil(targetSubscribers / linearSettings.subscribersPerMonth) : '∞'} bulan
                                                    </p>
                                                </div>
                                            )}

                                            {growthType === 'PERCENTAGE' && (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                                                            % Awal (Bulan 1)
                                                        </label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={percentageSettings.initialPercent}
                                                                onChange={e => setPercentageSettings({...percentageSettings, initialPercent: Number(e.target.value)})}
                                                                className="block w-24 py-2 px-3 text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700"
                                                            />
                                                            <span className="text-sm text-gray-500">%</span>
                                                            <span className="text-xs text-gray-400">
                                                                = {Math.round((percentageSettings.initialPercent / 100) * targetSubscribers)} pelanggan
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                                                            Pertumbuhan per Bulan
                                                        </label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={percentageSettings.monthlyGrowthPercent}
                                                                onChange={e => setPercentageSettings({...percentageSettings, monthlyGrowthPercent: Number(e.target.value)})}
                                                                className="block w-24 py-2 px-3 text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700"
                                                            />
                                                            <span className="text-sm text-gray-500">% dari target/bulan</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {growthType === 'CUSTOM' && (
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Milestone</span>
                                                        <button
                                                            type="button"
                                                            onClick={handleAddMilestone}
                                                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                                        >
                                                            <HiOutlinePlus className="w-3 h-3" />
                                                            Tambah
                                                        </button>
                                                    </div>
                                                    <div className="max-h-[140px] overflow-y-auto space-y-2">
                                                        {customMilestones.map((m, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                                                                <span className="text-xs text-gray-500 w-12">Bulan</span>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={m.month}
                                                                    onChange={e => updateMilestone(idx, 'month', Number(e.target.value))}
                                                                    className="block w-14 py-1.5 px-2 text-sm border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700"
                                                                />
                                                                <span className="text-xs text-gray-400">=</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    value={m.percent}
                                                                    onChange={e => updateMilestone(idx, 'percent', Number(e.target.value))}
                                                                    className="block w-14 py-1.5 px-2 text-sm border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700"
                                                                />
                                                                <span className="text-xs text-gray-500">%</span>
                                                                <span className="flex-1 text-xs text-gray-400 text-right">
                                                                    {Math.round((m.percent / 100) * targetSubscribers)} plg
                                                                </span>
                                                                {customMilestones.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveMilestone(idx)}
                                                                        className="text-red-400 hover:text-red-600 p-1"
                                                                    >
                                                                        <HiOutlineTrash className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Preview Chart & Analysis */}
                                <div className="space-y-5">
                                    {/* Chart */}
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-4">
                                            <HiOutlineChartBar className="w-5 h-5 text-indigo-500" />
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Proyeksi 24 Bulan</h3>
                                        </div>

                                        <div className="h-32 flex items-end gap-0.5">
                                            {previewSubscribers.map((subs, idx) => {
                                                const height = targetSubscribers > 0 ? (subs / targetSubscribers) * 100 : 0
                                                const isBepMonth = idx + 1 === realisticBepMonths
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`flex-1 rounded-t transition-all ${
                                                            isBepMonth
                                                                ? 'bg-green-500'
                                                                : realisticBepMonths !== Infinity && idx + 1 < realisticBepMonths
                                                                    ? 'bg-red-400'
                                                                    : 'bg-indigo-400'
                                                        }`}
                                                        style={{ height: `${Math.max(height, 2)}%` }}
                                                        title={`Bulan ${idx + 1}: ${subs} pelanggan`}
                                                    />
                                                )
                                            })}
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                            <span>Bln 1</span>
                                            <span>Bln 12</span>
                                            <span>Bln 24</span>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-4 text-xs">
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                                <span className="text-gray-500">Sebelum BEP</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <span className="text-gray-500">Titik BEP</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                                                <span className="text-gray-500">Setelah BEP</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Analysis Card */}
                                    <div className={`rounded-xl p-5 border ${
                                        profitPerMonth > 0
                                            ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'
                                            : 'bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800'
                                    }`}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <HiOutlineCalculator className={`w-5 h-5 ${profitPerMonth > 0 ? 'text-blue-500' : 'text-orange-500'}`} />
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Analisis BEP</h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">Target Tercapai</div>
                                                <div className="text-lg font-bold text-indigo-600">Bulan {monthsToFullCapacity}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">BEP Realistis</div>
                                                <div className={`text-lg font-bold ${realisticBepMonths <= 24 ? 'text-green-600' : 'text-orange-600'}`}>
                                                    {realisticBepMonths === Infinity ? '∞' : `Bulan ${realisticBepMonths}`}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">BEP Sederhana</div>
                                                <div className="text-lg font-bold text-gray-600 dark:text-gray-300">
                                                    {simpleBepMonths === Infinity ? '∞' : `${simpleBepMonths.toFixed(1)} bln`}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">Margin Profit</div>
                                                <div className={`text-lg font-bold ${margin > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {margin.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setMainTab('info')}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <HiOutlineDocumentText className="w-4 h-4" />
                                    Kembali
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMainTab('items')}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                >
                                    Lanjut ke Item & Biaya
                                    <HiOutlineCube className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Item & Biaya */}
                    {mainTab === 'items' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-left-2 duration-200">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800">
                                    <div className="flex items-center gap-2 mb-1">
                                        <HiOutlineCurrencyDollar className="w-4 h-4 text-green-500" />
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Est. Pendapatan</span>
                                    </div>
                                    <div className="text-xl font-bold text-green-700 dark:text-green-400 font-mono">{formatCurrency(projectedRevenue)}</div>
                                    <div className="text-xs text-gray-500">/bulan (full capacity)</div>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
                                    <div className="flex items-center gap-2 mb-1">
                                        <HiOutlineCube className="w-4 h-4 text-purple-500" />
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total CAPEX</span>
                                    </div>
                                    <div className="text-xl font-bold text-purple-700 dark:text-purple-400 font-mono">{formatCurrency(totalCapex)}</div>
                                    <div className="text-xs text-gray-500">{capexItems.length} item</div>
                                </div>
                                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-100 dark:border-orange-800">
                                    <div className="flex items-center gap-2 mb-1">
                                        <HiOutlineBanknotes className="w-4 h-4 text-orange-500" />
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total OPEX</span>
                                    </div>
                                    <div className="text-xl font-bold text-orange-700 dark:text-orange-400 font-mono">{formatCurrency(totalOpex)}</div>
                                    <div className="text-xs text-gray-500">/bulan ({opexItems.length} item)</div>
                                </div>
                            </div>

                            {/* CAPEX/OPEX Tabs */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                                {/* Tab Headers */}
                                <div className="flex border-b border-gray-200 dark:border-gray-700">
                                    <button
                                        type="button"
                                        onClick={() => setExpenseTab('CAPEX')}
                                        className={`flex-1 py-3 px-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
                                            expenseTab === 'CAPEX'
                                                ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/10'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        <HiOutlineCube className="w-4 h-4" />
                                        Modal Awal (CAPEX)
                                        <span className="ml-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                                            {formatCurrency(totalCapex)}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setExpenseTab('OPEX')}
                                        className={`flex-1 py-3 px-4 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
                                            expenseTab === 'OPEX'
                                                ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-900/10'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        <HiOutlineBanknotes className="w-4 h-4" />
                                        Operasional (OPEX)
                                        <span className="ml-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                                            {formatCurrency(totalOpex)}
                                        </span>
                                    </button>
                                </div>

                                {/* Toolbar */}
                                <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                    <div className="text-xs text-gray-500">
                                        {expenseTab === 'CAPEX'
                                            ? 'Biaya instalasi & perangkat awal (One-time cost)'
                                            : 'Biaya rutin bulanan (Recurring cost)'}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm text-white ${
                                            expenseTab === 'CAPEX'
                                                ? 'bg-purple-600 hover:bg-purple-700'
                                                : 'bg-orange-600 hover:bg-orange-700'
                                        }`}
                                    >
                                        <HiOutlinePlus className="w-4 h-4" /> Tambah Item
                                    </button>
                                </div>

                                {/* Item List */}
                                <div className="max-h-[280px] overflow-auto">
                                    {currentTabItems.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                            {expenseTab === 'CAPEX' ? (
                                                <HiOutlineCube className="w-10 h-10 mb-2 opacity-20" />
                                            ) : (
                                                <HiOutlineBanknotes className="w-10 h-10 mb-2 opacity-20" />
                                            )}
                                            <p className="text-sm">Belum ada item {expenseTab}</p>
                                            <button
                                                type="button"
                                                onClick={handleAddItem}
                                                className="mt-2 text-blue-500 hover:underline text-xs"
                                            >
                                                + Tambah Item
                                            </button>
                                        </div>
                                    ) : (
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium border-b dark:border-gray-600 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-2.5 w-[40%]">Nama Item</th>
                                                    <th className="px-4 py-2.5 w-[20%]">Kategori</th>
                                                    <th className="px-4 py-2.5 w-[12%] text-center">Qty</th>
                                                    <th className="px-4 py-2.5 w-[23%] text-right">Harga Satuan</th>
                                                    <th className="px-4 py-2.5 w-[5%]"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                {currentTabItems.map((item) => (
                                                    <tr key={item.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                        <td className="px-4 py-2">
                                                            <input
                                                                type="text"
                                                                value={item.name}
                                                                onChange={e => updateItem(item.id, 'name', e.target.value)}
                                                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm placeholder-gray-400"
                                                                placeholder="Nama item..."
                                                            />
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <select
                                                                value={item.category}
                                                                onChange={e => updateItem(item.id, 'category', e.target.value)}
                                                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-600 dark:text-gray-300"
                                                            >
                                                                <option value="DEVICE">Perangkat</option>
                                                                <option value="CABLE">Kabel</option>
                                                                <option value="ACCESSORIES">Aksesoris</option>
                                                                <option value="SERVICE">Jasa/Instalasi</option>
                                                                <option value="OPERATIONAL">Operasional</option>
                                                                <option value="OTHER">Lainnya</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity}
                                                                onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                                                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-center"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-2 text-right font-mono">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={item.unitPrice}
                                                                onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                                                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-right"
                                                            />
                                                            <div className="text-[10px] text-gray-400 mt-0.5">
                                                                = {formatCurrency(item.quantity * item.unitPrice)}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveItem(item.id)}
                                                                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                            >
                                                                <HiOutlineTrash className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 font-bold text-sm">
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">Total {expenseTab}:</td>
                                                    <td className="px-4 py-2.5 text-right font-mono text-gray-900 dark:text-white">
                                                        {formatCurrency(expenseTab === 'CAPEX' ? totalCapex : totalOpex)}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    )}
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setMainTab('growth')}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <HiOutlineArrowTrendingUp className="w-4 h-4" />
                                    Kembali
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Menyimpan...
                            </>
                        ) : (
                            <>
                                <HiOutlineCheck className="w-5 h-5" />
                                Simpan RAB
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
