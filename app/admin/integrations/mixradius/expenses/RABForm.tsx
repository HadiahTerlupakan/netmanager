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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 dark:text-gray-400 sm:text-sm font-medium">Rp</span>
            </div>
            <input
                type="number"
                min="0"
                value={value || ''}
                onChange={(e) => onChange && onChange(Number(e.target.value))}
                readOnly={readOnly}
                className={`block w-full pl-10 pr-12 py-2.5 sm:text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 transition-shadow group-hover:shadow-sm dark:placeholder-gray-500 ${readOnly ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed text-gray-500 dark:text-gray-400' : 'bg-white text-gray-900 dark:text-white'}`}
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
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono text-right ml-auto">
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
                {/* Wizard Stepper Headers */}
                <div className="flex items-center justify-between mb-8 px-4 relative">
                    {/* Background Line */}
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -translate-y-1/2 z-0 hidden sm:block"></div>
                    
                    {mainTabs.map((tab, idx) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setMainTab(tab.id)}
                            className="relative z-10 flex flex-col items-center group"
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                                mainTab === tab.id
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110'
                                    : mainTabs.findIndex(t => t.id === mainTab) > idx
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 group-hover:border-blue-400'
                            }`}>
                                {mainTabs.findIndex(t => t.id === mainTab) > idx ? (
                                    <HiOutlineCheck className="w-6 h-6" />
                                ) : (
                                    <tab.icon className="w-5 h-5" />
                                )}
                            </div>
                            <span className={`mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${
                                mainTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                            }`}>
                                {tab.label.split(' ')[0]}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Tab Content Wrapper */}
                <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 p-1 sm:p-2 min-h-[450px]">
                    {/* Tab 1: Informasi Proyek */}
                    {mainTab === 'info' && (
                        <div className="space-y-6 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Left Column: Basic Info */}
                                <div className="md:col-span-2 space-y-5">
                                    <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                                <HiOutlineDocumentText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Identitas Proyek</h3>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                                    Nama Proyek <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={formData.name}
                                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                                    className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 py-3 dark:text-white transition-all"
                                                    placeholder="e.g., Ekspansi Jaringan Cluster Wijaya - Tahap 1"
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Lokasi / Site</label>
                                                    <div className="relative">
                                                        <HiOutlineBuildingOffice className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                        <select
                                                            value={formData.mixRadiusGroupId}
                                                            onChange={e => setFormData({...formData, mixRadiusGroupId: e.target.value})}
                                                            className="block w-full pl-10 rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white appearance-none"
                                                        >
                                                            <option value="">-- Pilih Lokasi --</option>
                                                            {sites.map(s => (
                                                                <option key={s.id} value={s.id}>{s.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Estimasi Mulai</label>
                                                    <div className="relative">
                                                        <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                        <input
                                                            type="date"
                                                            value={formData.startDate}
                                                            onChange={e => setFormData({...formData, startDate: e.target.value})}
                                                            className="block w-full pl-10 rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Deskripsi Proyek</label>
                                                <textarea
                                                    value={formData.description}
                                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                                    className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white py-3"
                                                    rows={3}
                                                    placeholder="Jelaskan cakupan atau tujuan proyek..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Summary & Status */}
                                <div className="space-y-5">
                                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                                        <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                                            <HiOutlineCalculator className="w-32 h-32" />
                                        </div>
                                        
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-blue-100 mb-4">Financial Overview</h4>
                                        <div className="space-y-4 relative z-10">
                                            <div>
                                                <div className="text-[10px] text-blue-100 uppercase font-medium">Total Investasi (CAPEX)</div>
                                                <div className="text-2xl font-black">{formatCurrency(totalCapex)}</div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="text-[10px] text-blue-100 uppercase font-medium">OPEX/Bulan</div>
                                                    <div className="text-sm font-bold">{formatCurrency(totalOpex)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-blue-100 uppercase font-medium">Est. BEP</div>
                                                    <div className="text-sm font-bold">
                                                        {realisticBepMonths === Infinity ? '∞' : `${realisticBepMonths} Bln`}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Status Dokumen</div>
                                        <div className="flex flex-wrap gap-2">
                                            {['DRAFT', 'PENDING', 'APPROVED'].map(status => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => setFormData({...formData, status})}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                        formData.status === status
                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                                            : 'bg-gray-50 text-gray-400 dark:bg-gray-700/50 border border-transparent hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-end pt-4">
                                <button
                                    type="button"
                                    onClick={() => setMainTab('growth')}
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 active:scale-95"
                                >
                                    Selanjutnya: Model Pertumbuhan
                                    <HiOutlineArrowTrendingUp className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Periode Pertumbuhan */}
                    {mainTab === 'growth' && (
                        <div className="space-y-6 p-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Left: Configuration */}
                                <div className="space-y-6">
                                    <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <div className="flex items-center gap-2 mb-5">
                                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                                <HiOutlineUsers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Target & Pendapatan</h3>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Target Pelanggan</label>
                                                <div className="relative">
                                                    <HiOutlineUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                    <input
                                                        type="number"
                                                        value={targetSubscribers || ''}
                                                        onChange={e => setTargetSubscribers(Number(e.target.value))}
                                                        className="block w-full pl-10 pr-4 py-3 text-sm border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-800 dark:text-white"
                                                        placeholder="e.g., 200"
                                                    />
                                                </div>
                                            </div>
                                            <CurrencyInput
                                                label="ARPU (Harga Rata-rata/Bln)"
                                                value={arpu}
                                                onChange={setArpu}
                                                placeholder="150000"
                                            />
                                        </div>

                                        {projectedRevenue > 0 && (
                                            <div className="mt-5 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/30 flex justify-between items-center">
                                                <div className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">Potensi Revenue (Full Capacity)</div>
                                                <div className="text-lg font-black text-green-700 dark:text-green-400">{formatCurrency(projectedRevenue)}/Bln</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <div className="flex items-center gap-2 mb-5">
                                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                                <HiOutlineArrowTrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Model Pertumbuhan</h3>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 mb-5">
                                            {(['LINEAR', 'PERCENTAGE', 'CUSTOM'] as GrowthType[]).map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setGrowthType(type)}
                                                    className={`py-3 px-2 text-[10px] sm:text-xs font-black rounded-xl border transition-all duration-300 ${
                                                        growthType === type
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                                                            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                                                    }`}
                                                >
                                                    {type === 'LINEAR' ? 'LINEAR' : type === 'PERCENTAGE' ? 'PERSENTASE' : 'KUSTOM'}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-inner min-h-[140px]">
                                            {growthType === 'LINEAR' && (
                                                <div className="animate-in fade-in zoom-in-95 duration-300">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Penambahan Pelanggan / Bulan</label>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="number"
                                                            value={linearSettings.subscribersPerMonth}
                                                            onChange={e => setLinearSettings({ subscribersPerMonth: Number(e.target.value) })}
                                                            className="block w-full py-3 px-4 text-sm border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700"
                                                        />
                                                        <span className="text-sm font-bold text-gray-400">PLG</span>
                                                    </div>
                                                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 leading-relaxed italic">
                                                        Target {targetSubscribers} pelanggan akan tercapai dalam ±{linearSettings.subscribersPerMonth > 0 ? Math.ceil(targetSubscribers / linearSettings.subscribersPerMonth) : '∞'} bulan secara konstan.
                                                    </div>
                                                </div>
                                            )}

                                            {growthType === 'PERCENTAGE' && (
                                                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">% Awal (Bln 1)</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="number"
                                                                    value={percentageSettings.initialPercent}
                                                                    onChange={e => setPercentageSettings({...percentageSettings, initialPercent: Number(e.target.value)})}
                                                                    className="block w-full py-3 px-4 text-sm border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700"
                                                                />
                                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Laju Pertumbuhan</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="number"
                                                                    value={percentageSettings.monthlyGrowthPercent}
                                                                    onChange={e => setPercentageSettings({...percentageSettings, monthlyGrowthPercent: Number(e.target.value)})}
                                                                    className="block w-full py-3 px-4 text-sm border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700"
                                                                />
                                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 text-center italic">Pelanggan akan bertambah {percentageSettings.monthlyGrowthPercent}% dari target setiap bulannya.</p>
                                                </div>
                                            )}

                                            {growthType === 'CUSTOM' && (
                                                <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs font-bold text-gray-500 uppercase">Target Bertahap (Milestone)</span>
                                                        <button
                                                            type="button"
                                                            onClick={handleAddMilestone}
                                                            className="flex items-center gap-1 text-xs px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-colors font-black"
                                                        >
                                                            <HiOutlinePlus className="w-3 h-3" /> TAMBAH
                                                        </button>
                                                    </div>
                                                    <div className="max-h-[160px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                                        {customMilestones.map((m, idx) => (
                                                            <div key={idx} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/30 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 group">
                                                                <div className="flex-1 grid grid-cols-2 gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Bln</span>
                                                                        <input
                                                                            type="number"
                                                                            value={m.month}
                                                                            onChange={e => updateMilestone(idx, 'month', Number(e.target.value))}
                                                                            className="w-full py-1.5 px-2 text-sm border-gray-200 dark:border-gray-600 rounded-lg focus:ring-indigo-500 dark:bg-gray-700 font-bold"
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">%</span>
                                                                        <input
                                                                            type="number"
                                                                            value={m.percent}
                                                                            onChange={e => updateMilestone(idx, 'percent', Number(e.target.value))}
                                                                            className="w-full py-1.5 px-2 text-sm border-gray-200 dark:border-gray-600 rounded-lg focus:ring-indigo-500 dark:bg-gray-700 font-bold"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="text-[10px] font-mono text-indigo-500 font-bold w-12 text-center">
                                                                    {Math.round((m.percent / 100) * targetSubscribers)} plg
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveMilestone(idx)}
                                                                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                                                                >
                                                                    <HiOutlineTrash className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Analytics */}
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm relative">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                                    <HiOutlineChartBar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Proyeksi Pertumbuhan</h3>
                                            </div>
                                            <div className="text-[10px] font-black bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">24 BULAN</div>
                                        </div>

                                        <div className="h-40 flex items-end gap-1.5 group/chart">
                                            {previewSubscribers.map((subs, idx) => {
                                                const height = targetSubscribers > 0 ? (subs / targetSubscribers) * 100 : 0
                                                const isBepMonth = idx + 1 === realisticBepMonths
                                                const isFuture = idx + 1 > realisticBepMonths
                                                
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`flex-1 rounded-t-md transition-all duration-500 ease-out hover:brightness-110 relative ${
                                                            isBepMonth
                                                                ? 'bg-green-500 shadow-lg shadow-green-500/20 z-10 scale-y-105'
                                                                : idx + 1 < realisticBepMonths
                                                                    ? 'bg-red-400/80'
                                                                    : 'bg-indigo-500/90'
                                                        }`}
                                                        style={{ height: `${Math.max(height, 4)}%` }}
                                                    >
                                                        {/* Tooltip on hover */}
                                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] py-1 px-1.5 rounded opacity-0 group-hover/chart:opacity-100 pointer-events-none transition-opacity z-20 whitespace-nowrap">
                                                            Bln {idx + 1}: {subs}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-3 border-t border-gray-100 dark:border-gray-700 pt-2">
                                            <span>AWAL</span>
                                            <span>TAHUN 1</span>
                                            <span>TAHUN 2</span>
                                        </div>

                                        <div className="mt-5 grid grid-cols-3 gap-2">
                                            {[
                                                { label: 'Pra-BEP', color: 'bg-red-400/80' },
                                                { label: 'Titik BEP', color: 'bg-green-500' },
                                                { label: 'Profitabel', color: 'bg-indigo-500/90' }
                                            ].map(item => (
                                                <div key={item.label} className="flex items-center gap-1.5">
                                                    <div className={`w-2.5 h-2.5 ${item.color} rounded-full`}></div>
                                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{item.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={`rounded-2xl p-6 border transition-colors duration-500 ${
                                        margin > 20
                                            ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
                                            : margin > 0
                                                ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'
                                                : 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                                    }`}>
                                        <div className="flex items-center gap-2 mb-6">
                                            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                                <HiOutlineCalculator className={`w-5 h-5 ${margin > 0 ? 'text-blue-500' : 'text-red-500'}`} />
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Kesimpulan BEP</h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                            <div className="space-y-1">
                                                <div className="text-[10px] text-gray-400 uppercase font-black">Full Capacity</div>
                                                <div className="text-xl font-black text-gray-900 dark:text-white">Bulan {monthsToFullCapacity}</div>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <div className="text-[10px] text-gray-400 uppercase font-black">BEP Realistis</div>
                                                <div className={`text-xl font-black ${realisticBepMonths <= 18 ? 'text-green-600' : realisticBepMonths <= 36 ? 'text-blue-600' : 'text-red-600'}`}>
                                                    {realisticBepMonths === Infinity ? '∞' : `Bulan ${realisticBepMonths}`}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-[10px] text-gray-400 uppercase font-black">BEP Sederhana</div>
                                                <div className="text-lg font-bold text-gray-600 dark:text-gray-300">
                                                    {simpleBepMonths === Infinity ? '∞' : `${simpleBepMonths.toFixed(1)} Bln`}
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <div className="text-[10px] text-gray-400 uppercase font-black">Gross Margin</div>
                                                <div className={`text-lg font-black ${margin > 25 ? 'text-green-600' : margin > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                    {margin.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-between items-center pt-6 border-t border-gray-100 dark:border-gray-800">
                                <button
                                    type="button"
                                    onClick={() => setMainTab('info')}
                                    className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors group"
                                >
                                    <div className="p-1.5 rounded-lg group-hover:bg-gray-100 dark:group-hover:bg-gray-800 transition-colors">
                                        <HiOutlineDocumentText className="w-5 h-5" />
                                    </div>
                                    Kembali ke Informasi
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMainTab('items')}
                                    className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 active:scale-95"
                                >
                                    Lanjut: Detail Item & Biaya
                                    <HiOutlineCube className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Item & Biaya */}
                    {mainTab === 'items' && (
                        <div className="space-y-6 p-4 animate-in fade-in slide-in-from-left-4 duration-500">
                            {/* Summary Metris */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-900/30 group">
                                    <div className="flex items-center gap-2 mb-2 text-green-600 dark:text-green-400">
                                        <HiOutlineCurrencyDollar className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Est. Pendapatan</span>
                                    </div>
                                    <div className="text-xl font-black text-green-800 dark:text-green-400 font-mono tracking-tighter group-hover:scale-105 transition-transform origin-left">{formatCurrency(projectedRevenue)}</div>
                                    <div className="text-[10px] text-green-600/60 font-bold uppercase mt-1">/Bulan (Kapasitas Penuh)</div>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/10 dark:to-fuchsia-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/30 group">
                                    <div className="flex items-center gap-2 mb-2 text-purple-600 dark:text-purple-400">
                                        <HiOutlineCube className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Total Capex</span>
                                    </div>
                                    <div className="text-xl font-black text-purple-800 dark:text-purple-400 font-mono tracking-tighter group-hover:scale-105 transition-transform origin-left">{formatCurrency(totalCapex)}</div>
                                    <div className="text-[10px] text-purple-600/60 font-bold uppercase mt-1">{capexItems.length} Komponen Investasi</div>
                                </div>
                                <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30 group">
                                    <div className="flex items-center gap-2 mb-2 text-orange-600 dark:text-orange-400">
                                        <HiOutlineBanknotes className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Total Opex</span>
                                    </div>
                                    <div className="text-xl font-black text-orange-800 dark:text-orange-400 font-mono tracking-tighter group-hover:scale-105 transition-transform origin-left">{formatCurrency(totalOpex)}</div>
                                    <div className="text-[10px] text-orange-600/60 font-bold uppercase mt-1">{opexItems.length} Biaya Operasional/Bln</div>
                                </div>
                            </div>

                            {/* Multi-Step Cost Configuration */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex flex-col">
                                {/* Type Switcher */}
                                <div className="flex p-2 bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                    <button
                                        type="button"
                                        onClick={() => setExpenseTab('CAPEX')}
                                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 ${
                                            expenseTab === 'CAPEX'
                                                ? 'bg-white dark:bg-gray-800 text-purple-600 shadow-sm border border-purple-100 dark:border-purple-900/50'
                                                : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                    >
                                        <HiOutlineCube className="w-4 h-4" />
                                        INVESTASI AWAL (CAPEX)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setExpenseTab('OPEX')}
                                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 ${
                                            expenseTab === 'OPEX'
                                                ? 'bg-white dark:bg-gray-800 text-orange-600 shadow-sm border border-orange-100 dark:border-orange-900/50'
                                                : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                    >
                                        <HiOutlineBanknotes className="w-4 h-4" />
                                        OPERASIONAL (OPEX)
                                    </button>
                                </div>

                                {/* Header Table Tool */}
                                <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-gray-800 dark:text-gray-200">
                                            {expenseTab === 'CAPEX' ? 'Komponen Modal & Aset' : 'Estimasi Biaya Bulanan'}
                                        </span>
                                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">
                                            Total {expenseTab}: {formatCurrency(expenseTab === 'CAPEX' ? totalCapex : totalOpex)}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black text-white transition-all shadow-lg active:scale-95 ${
                                            expenseTab === 'CAPEX'
                                                ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'
                                                : 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20'
                                        }`}
                                    >
                                        <HiOutlinePlus className="w-4 h-4" /> TAMBAH ITEM
                                    </button>
                                </div>

                                {/* Items Interactive List */}
                                <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                    {currentTabItems.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                                            <div className={`p-6 rounded-full mb-4 ${expenseTab === 'CAPEX' ? 'bg-purple-50 text-purple-200' : 'bg-orange-50 text-orange-200'}`}>
                                                {expenseTab === 'CAPEX' ? <HiOutlineCube className="w-12 h-12" /> : <HiOutlineBanknotes className="w-12 h-12" />}
                                            </div>
                                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Belum ada item {expenseTab} ditambahkan</p>
                                            <button onClick={handleAddItem} className="mt-4 text-xs font-black text-blue-500 hover:underline">MULAI TAMBAH ITEM SEKARANG</button>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left border-collapse">
                                                <thead className="bg-gray-50/80 dark:bg-gray-900/50 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b dark:border-gray-700 sticky top-0 z-10 backdrop-blur-sm">
                                                    <tr>
                                                        <th className="px-6 py-4 w-[45%]">Nama Deskripsi</th>
                                                        <th className="px-4 py-4 w-[15%]">Kategori</th>
                                                        <th className="px-4 py-4 w-[10%] text-center">QTY</th>
                                                        <th className="px-4 py-4 w-[25%] text-right">Harga Satuan (IDR)</th>
                                                        <th className="px-6 py-4 w-[5%]"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                    {currentTabItems.map((item) => (
                                                        <tr key={item.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-all">
                                                            <td className="px-6 py-4">
                                                                <input
                                                                    type="text"
                                                                    value={item.name}
                                                                    onChange={e => updateItem(item.id, 'name', e.target.value)}
                                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-semibold placeholder-gray-300 dark:text-white"
                                                                    placeholder="e.g., Mikrotik RB4011..."
                                                                />
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                <select
                                                                    value={item.category}
                                                                    onChange={e => updateItem(item.id, 'category', e.target.value)}
                                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-bold text-gray-500 dark:text-gray-400 appearance-none cursor-pointer hover:text-blue-500"
                                                                >
                                                                    <option value="DEVICE">Perangkat</option>
                                                                    <option value="CABLE">Kabel/FO</option>
                                                                    <option value="ACCESSORIES">Aksesoris</option>
                                                                    <option value="SERVICE">Jasa/Skill</option>
                                                                    <option value="OPERATIONAL">Operasional</option>
                                                                    <option value="OTHER">Lainnya</option>
                                                                </select>
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                <input
                                                                    type="number"
                                                                    value={item.quantity}
                                                                    onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-center font-bold dark:text-white"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-4 text-right">
                                                                <div className="flex flex-col items-end">
                                                                    <input
                                                                        type="number"
                                                                        value={item.unitPrice}
                                                                        onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                                                                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-right font-black dark:text-white"
                                                                        placeholder="0"
                                                                    />
                                                                    <span className="text-[10px] font-mono font-bold text-gray-400 mt-1">
                                                                        {formatCurrency(item.quantity * item.unitPrice)}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveItem(item.id)}
                                                                    className="text-gray-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <HiOutlineTrash className="w-5 h-5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-between items-center pt-6 border-t border-gray-100 dark:border-gray-800">
                                <button
                                    type="button"
                                    onClick={() => setMainTab('growth')}
                                    className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors group"
                                >
                                    <div className="p-1.5 rounded-lg group-hover:bg-gray-100 dark:group-hover:bg-gray-800 transition-colors">
                                        <HiOutlineArrowTrendingUp className="w-5 h-5" />
                                    </div>
                                    Kembali ke Pertumbuhan
                                </button>
                                <div className="text-xs font-black text-gray-400 italic">
                                    Semua perubahan tersimpan secara lokal saat Anda berpindah tab.
                                </div>
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
