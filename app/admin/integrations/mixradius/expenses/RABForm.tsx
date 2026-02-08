'use client'

import { useState, useEffect } from 'react'
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
    HiOutlineBanknotes
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
                className={`block w-full pl-10 pr-12 py-2.5 sm:text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 transition-shadow group-hover:shadow-sm ${readOnly ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed text-gray-500' : ''}`}
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

type ExpenseType = 'CAPEX' | 'OPEX'

interface LocalItem {
    id: string
    name: string
    category: string
    quantity: number
    unitPrice: number
    expenseType: ExpenseType
}

export default function RABForm({ isOpen, initialData, sites, onSaved, onClose }: RABFormProps) {
    const [activeTab, setActiveTab] = useState<ExpenseType>('CAPEX')
    
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        mixRadiusGroupId: '',
        siteId: '',
        projectedRevenue: 0,
        status: 'DRAFT'
    })

    // Additional state for calculator (Services)
    const [calculator, setCalculator] = useState({
        targetSubscribers: 0,
        arpu: 0
    })

    const [items, setItems] = useState<LocalItem[]>([])

    const [isSubmitting, setIsSubmitting] = useState(false)

    // Initialize data if editing when modal opens
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name,
                    description: initialData.description || '',
                    mixRadiusGroupId: initialData.mixRadiusGroupId || '',
                    siteId: initialData.siteId || '',
                    projectedRevenue: Number(initialData.projectedRevenue),
                    status: initialData.status
                })
                
                // Load items and ensure expenseType is set (default to CAPEX for legacy data)
                // We map from initialData.items which might have expenseType now
                setItems(initialData.items.map(item => ({
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    // @ts-expect-error - expenseType might not be in older interface definitions yet but comes from API
                    expenseType: item.expenseType || 'CAPEX'
                })))
            } else {
                 // Reset form
                 setFormData({
                    name: '',
                    description: '',
                    mixRadiusGroupId: '',
                    siteId: '',
                    projectedRevenue: 0,
                    status: 'DRAFT'
                })
                setCalculator({
                    targetSubscribers: 0,
                    arpu: 0
                })
                 setItems([
                     { id: crypto.randomUUID(), name: '', category: 'DEVICE', quantity: 1, unitPrice: 0, expenseType: 'CAPEX' }
                 ])
            }
            setActiveTab('CAPEX')
        }
    }, [initialData, isOpen])

    // Update revenue when calculator changes
    useEffect(() => {
        if (calculator.targetSubscribers > 0 && calculator.arpu > 0) {
            const revenue = calculator.targetSubscribers * calculator.arpu
            setFormData(prev => ({ ...prev, projectedRevenue: revenue }))
        }
    }, [calculator.targetSubscribers, calculator.arpu])

    const handleAddItem = () => {
        setItems([...items, {
            id: crypto.randomUUID(),
            name: '',
            category: activeTab === 'CAPEX' ? 'DEVICE' : 'OPERATIONAL', // Default category based on type
            quantity: 1,
            unitPrice: 0,
            expenseType: activeTab
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

    // Calculations
    const capexItems = items.filter(i => i.expenseType === 'CAPEX')
    const opexItems = items.filter(i => i.expenseType === 'OPEX')

    const totalCapex = capexItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const totalOpex = opexItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    
    // Profit Calculation
    const profitPerMonth = formData.projectedRevenue - totalOpex
    const bepMonths = profitPerMonth > 0 ? totalCapex / profitPerMonth : Infinity
    const margin = formData.projectedRevenue > 0 ? (profitPerMonth / formData.projectedRevenue) * 100 : 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name) {
            toast.error('Nama proyek wajib diisi')
            return
        }
        
        setIsSubmitting(true)

        try {
            // Determine Site ID logic similar to ExpensesClient
            let finalSiteId = formData.siteId
            const selectedGroup = sites.find(s => s.id === formData.mixRadiusGroupId)
            if (selectedGroup && selectedGroup.siteId) {
                finalSiteId = selectedGroup.siteId
            }

            const payload = {
                ...formData,
                projectedOpex: totalOpex, // Automatically calculated from items
                siteId: finalSiteId,
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

            if (!res.ok) throw new Error('Gagal menyimpan RAB')

            toast.success(initialData ? 'RAB diperbarui' : 'RAB dibuat')
            onSaved()
        } catch (error) {
            console.error(error)
            toast.error('Terjadi kesalahan')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Render items for current tab
    const currentTabItems = activeTab === 'CAPEX' ? capexItems : opexItems

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? 'Edit RAB Proyek' : 'Buat RAB Proyek Baru'}
            size="3xl"
        >
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
                {/* Header Section */}
                <div className="grid grid-cols-1 gap-6">
                    {/* Project Info */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-4">
                            <HiOutlineDocumentText className="w-5 h-5 text-blue-500" />
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Informasi Proyek</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nama Proyek</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500 py-2.5"
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
                                        className="block w-full pl-9 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-2.5 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">-- Pilih Lokasi --</option>
                                        {sites.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Deskripsi / Catatan</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    rows={2}
                                    placeholder="Deskripsi singkat mengenai proyek ini..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Service & Revenue Projection Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                         {/* Inputs */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <HiOutlineCurrencyDollar className="w-5 h-5 text-green-500" />
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Potensi Layanan & Pendapatan</h3>
                            </div>
                            
                            {/* Calculator Inputs */}
                            <div className="bg-green-50/50 dark:bg-green-900/10 p-4 rounded-lg border border-green-100 dark:border-green-900/30 space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Target Jumlah Pelanggan</label>
                                    <div className="relative">
                                        <HiOutlineUsers className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                        <input
                                            type="number"
                                            min="0"
                                            value={calculator.targetSubscribers || ''}
                                            onChange={e => setCalculator({...calculator, targetSubscribers: Number(e.target.value)})}
                                            className="block w-full pl-9 pr-4 py-2 text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-green-500 focus:border-green-500 dark:bg-gray-800"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                
                                <CurrencyInput
                                    label="Rata-rata Harga Paket (ARPU)"
                                    value={calculator.arpu}
                                    onChange={(val) => setCalculator({...calculator, arpu: val})}
                                    placeholder="Contoh: 150000"
                                />

                                <div className="pt-2 border-t border-green-200 dark:border-green-800/30 flex justify-between items-center">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Total Est. Pendapatan:</span>
                                    <span className="font-bold text-green-700 dark:text-green-400 font-mono">
                                        {formatCurrency(formData.projectedRevenue)}
                                    </span>
                                </div>
                            </div>

                            <CurrencyInput
                                label="Total Biaya Operasional (OPEX/bln)"
                                value={totalOpex}
                                readOnly
                                helperText="*Dihitung otomatis dari tab Operasional (OPEX)"
                            />
                        </div>

                        {/* Result Card */}
                        <div className="flex flex-col h-full justify-end">
                             <div className={`rounded-xl p-5 border h-full flex flex-col justify-center ${
                                profitPerMonth > 0 
                                    ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800' 
                                    : 'bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800'
                            }`}>
                                <div className="flex items-start gap-3 mb-3">
                                    <HiOutlineCalculator className={`w-6 h-6 mt-0.5 ${
                                        profitPerMonth > 0 ? 'text-blue-500' : 'text-orange-500'
                                    }`} />
                                    <div>
                                        <h4 className={`font-bold ${
                                            profitPerMonth > 0 ? 'text-blue-800 dark:text-blue-300' : 'text-orange-800 dark:text-orange-300'
                                        }`}>Analisis Profitabilitas</h4>
                                    </div>
                                </div>

                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Profit Bersih/bln:</span>
                                        <span className={`font-mono font-bold text-base ${
                                            profitPerMonth > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                                        }`}>
                                            {formatCurrency(profitPerMonth)}
                                        </span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Margin Profit:</span>
                                        <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                                            {margin.toFixed(1)}%
                                        </span>
                                    </div>

                                    <div className="h-px bg-current opacity-20 my-2" />

                                    <div className="flex justify-between items-center pt-1">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Estimasi BEP:</span>
                                        <span className={`font-bold text-lg ${
                                            bepMonths < 12 ? 'text-green-600' : bepMonths < 24 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                            {bepMonths === Infinity ? '∞' : `${bepMonths.toFixed(1)} Bulan`}
                                        </span>
                                    </div>
                                    {bepMonths !== Infinity && (
                                        <p className="text-xs text-gray-500 mt-1 italic text-center">
                                            *Modal (CAPEX: {formatCurrency(totalCapex)}) kembali dalam {Math.ceil(bepMonths)} bulan operasi.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TABS Section for Items */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex flex-col min-h-[400px]">
                        {/* Tab Headers */}
                        <div className="flex border-b border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => setActiveTab('CAPEX')}
                                className={`flex-1 py-4 px-6 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
                                    activeTab === 'CAPEX' 
                                        ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/10' 
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                <HiOutlineCube className="w-5 h-5" />
                                Modal Awal (CAPEX)
                                <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                                    {formatCurrency(totalCapex)}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('OPEX')}
                                className={`flex-1 py-4 px-6 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
                                    activeTab === 'OPEX' 
                                        ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-900/10' 
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                <HiOutlineBanknotes className="w-5 h-5" />
                                Operasional Bulanan (OPEX)
                                <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                                    {formatCurrency(totalOpex)}
                                </span>
                            </button>
                        </div>

                        {/* Toolbar */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <div className="text-xs text-gray-500">
                                {activeTab === 'CAPEX' 
                                    ? 'Daftar barang dan biaya instalasi awal (One-time cost)' 
                                    : 'Daftar biaya rutin bulanan (Recurring cost)'}
                            </div>
                            <button 
                                type="button" 
                                onClick={handleAddItem}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm text-white ${
                                    activeTab === 'CAPEX' 
                                        ? 'bg-purple-600 hover:bg-purple-700 border border-purple-600' 
                                        : 'bg-orange-600 hover:bg-orange-700 border border-orange-600'
                                }`}
                            >
                                <HiOutlinePlus className="w-4 h-4" /> Tambah Item {activeTab}
                            </button>
                        </div>

                        {/* Item List */}
                        <div className="flex-1 overflow-auto max-h-[400px]">
                            {currentTabItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400">
                                    {activeTab === 'CAPEX' ? (
                                        <HiOutlineCube className="w-12 h-12 mb-3 opacity-20" />
                                    ) : (
                                        <HiOutlineBanknotes className="w-12 h-12 mb-3 opacity-20" />
                                    )}
                                    <p className="text-sm">Belum ada item {activeTab}</p>
                                    <button 
                                        type="button" 
                                        onClick={handleAddItem}
                                        className="mt-2 text-blue-500 hover:underline text-xs"
                                    >
                                        Tambah Item Baru
                                    </button>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium border-b dark:border-gray-600 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 w-[40%]">Nama Item</th>
                                            <th className="px-4 py-3 w-[20%]">Kategori</th>
                                            <th className="px-4 py-3 w-[15%] text-center">Qty</th>
                                            <th className="px-4 py-3 w-[20%] text-right">Harga Satuan</th>
                                            <th className="px-4 py-3 w-[5%]"></th>
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
                                                        Total: {formatCurrency(item.quantity * item.unitPrice)}
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
                                            <td colSpan={3} className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">Total {activeTab}:</td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                                                {formatCurrency(activeTab === 'CAPEX' ? totalCapex : totalOpex)}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
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
