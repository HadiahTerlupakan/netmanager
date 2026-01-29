"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { HiPlus, HiTrash, HiSave, HiArrowLeft } from 'react-icons/hi'
import { HiOutlineTag } from 'react-icons/hi2'
import { Combobox } from '@/components/ui/Combobox'
import type { ComboboxOption } from '@/components/ui/Combobox'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { MarketPriceCheck } from '@/components/procurement/MarketPriceCheck'
import { Modal } from '@/components/ui/Modal'

interface PurchaseOrderFormProps {
    initialData?: any
    isEdit?: boolean
    disabled?: boolean
    readOnly?: boolean
}

type ItemRow = {
    id: string
    barangId: string
    barangName: string // For display if combobox needs it or just cache
    satuan?: string
    quantity: number
    unitPrice: number
}

// Helper to format currency input
const formatNumber = (num: number) => num.toString()

export default function PurchaseOrderForm({ initialData, isEdit = false, disabled = false, readOnly = false }: PurchaseOrderFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const isReadOnly = disabled || readOnly
    
    // Form State
    const [items, setItems] = useState<ItemRow[]>(
        initialData?.items?.map((i: any) => ({
            id: i.id,
            barangId: i.barangId,
            barangName: i.barang?.nama || 'Unknown',
            quantity: i.quantity,
            unitPrice: i.unitPrice
        })) || []
    )

    // Option State
    const [productOptions, setProductOptions] = useState<ComboboxOption[]>([])
    const [productDetails, setProductDetails] = useState<Record<string, any>>({}) // Cache for product info
    const [loadingProducts, setLoadingProducts] = useState(false)

    // Gudang State
    const [gudangId, setGudangId] = useState<string>('')
    const [gudangOptions, setGudangOptions] = useState<ComboboxOption[]>([])
    const [loadingGudangs, setLoadingGudangs] = useState(false)
    const [gudangDetails, setGudangDetails] = useState<Record<string, any>>({})
    const [notes, setNotes] = useState<string>('')

    // Company Profile State
    const [companyProfile, setCompanyProfile] = useState({
        perusahaan: 'PT. NETWORK SOLUTIONS',
        namaAplikasi: 'NETMANAGER',
        alamat: 'Jl. Utama No. 1, Jakarta Selatan\nDKI Jakarta, Indonesia 12345',
        nomorHp: '(021) 1234-5678',
        email: 'procurement@netmanager.com'
    })

    // Market Price Modal State
    const [isMarketPriceOpen, setIsMarketPriceOpen] = useState(false)
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null)
    const [activeKeyword, setActiveKeyword] = useState('')

    // Simple ID generator to avoid crypto issues on some browsers/contexts
    const generateId = () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Initial Load
    useEffect(() => {
        // Load initial products (first page)
        searchProducts('')

        // Load Gudangs
        searchGudangs('')
        
        // Load Company Settings
        fetch('/api/settings/general')
            .then(res => res.json())
            .then(data => {
                if (data.perusahaan) {
                    setCompanyProfile({
                        perusahaan: data.perusahaan,
                        namaAplikasi: data.namaAplikasi,
                        alamat: data.alamat,
                        nomorHp: data.nomorHp,
                        email: data.email
                    })
                }
            })
            .catch(err => console.error('Failed to load company settings', err))
        
        if (initialData) {
            setNotes(initialData.notes || '')
            // Pre-fill options with initial data to ensure they render
            if (initialData.items) {
                 const newOpts: ComboboxOption[] = []
                 initialData.items.forEach((i: any) => {
                     newOpts.push({ value: i.barangId, label: i.barang?.nama || 'Unknown' })
                 })
                 setProductOptions(prev => {
                     // Merge unique
                     const existing = new Set(prev.map(p => p.value))
                     const unique = newOpts.filter(n => !existing.has(n.value))
                     return [...prev, ...unique]
                 })
            }
        }
    }, [initialData])

    const searchGudangs = useCallback(async (query: string) => {
        setLoadingGudangs(true)
        try {
            // Re-using GET /api/inventory/gudang logic. It might filter by site if user is restricted
            const res = await fetch(`/api/inventory/gudang`)
            const json = await res.json()
            if (json.gudangs) {
                // Filter client side if needed, or api handles it
                setGudangOptions(json.gudangs.map((g: any) => ({
                    value: g.id,
                    label: g.nama
                })))
                // cache details for address display
                const details = json.gudangs.reduce((acc: any, g: any) => ({ ...acc, [g.id]: g }), {})
                setGudangDetails(prev => ({ ...prev, ...details }))
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingGudangs(false)
        }
    }, [])

    const searchProducts = useCallback(async (query: string) => {
        setLoadingProducts(true)
        try {
            const params = new URLSearchParams({ limit: '20', search: query })
            const res = await fetch(`/api/inventory/barang?${params}`)
            const json = await res.json()
            if (json.barangs) {
                setProductOptions(json.barangs.map((b: any) => ({
                    value: b.id,
                    label: b.nama
                })))
                // Update cache
                const newDetails = json.barangs.reduce((acc: any, b: any) => ({ ...acc, [b.id]: b }), {})
                setProductDetails(prev => ({ ...prev, ...newDetails }))
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingProducts(false)
        }
    }, [])

    const handleAddItem = () => {
        setItems([...items, {
            id: generateId(),
            barangId: '',
            barangName: '',
            quantity: 1,
            unitPrice: 0
        }])
    }

    const handleRemoveItem = (index: number) => {
        const newItems = [...items]
        newItems.splice(index, 1)
        setItems(newItems)
    }

    const updateItem = (index: number, field: keyof ItemRow, value: any) => {
        const newItems = [...items]
        // Auto-fill details if product changed
        if (field === 'barangId') {
            const detail = productDetails[value]
            if (detail) {
                newItems[index] = { 
                    ...newItems[index], 
                    [field]: value,
                    barangName: detail.nama, // Update name for market price search
                    satuan: detail.satuan,
                    unitPrice: detail.hargaBeli || 0
                } as ItemRow
                setItems(newItems)
                return
            }
        }
        newItems[index] = { ...newItems[index], [field]: value } as ItemRow
        setItems(newItems)
    }

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    }

    const openMarketPriceModal = (index: number) => {
        const item = items[index]
        if (!item) return
        setActiveItemIndex(index)
        
        // Try to get name from combobox option if not in item state directly
        // Ensure string
        const itemName = String(item.barangName || productOptions.find(p => p.value === item.barangId)?.label || '')
        setActiveKeyword(itemName)
        setIsMarketPriceOpen(true)
    }

    const handleSelectMarketPrice = (price: number) => {
        if (activeItemIndex !== null) {
            updateItem(activeItemIndex, 'unitPrice', price)
            toast.success("Harga satuan diperbarui dari referensi pasar")
            setIsMarketPriceOpen(false)
        }
    }

    const handleSubmit = async () => {
        if (items.length === 0) {
            toast.error("Tambahkan minimal 1 barang")
            return
        }
        // Validation: Check if all items have barangId
        if (items.some(i => !i.barangId)) {
            toast.error("Pilih barang untuk semua item")
            return
        }

        setLoading(true)
        try {
            const itemsPayload: any = {
                create: items.map(i => ({
                    barangId: i.barangId,
                    quantity: Number(i.quantity),
                    unitPrice: Number(i.unitPrice),
                    totalPrice: Number(i.quantity) * Number(i.unitPrice),
                    id: generateId() // Use safe generator
                }))
            }

            if (isEdit) {
                itemsPayload.deleteMany = {}
            }

            // Append Ship To to notes if selected
            let finalNotes = notes
            if (gudangId && gudangDetails[gudangId]) {
                const g = gudangDetails[gudangId]
                const shipToText = `\n\n[Ship To Warehouse: ${g.nama} - ${g.lokasi || ''}]`
                // prevent duplicate append on edit if present?
                if (!finalNotes.includes('[Ship To Warehouse:')) {
                    finalNotes += shipToText
                }
            }

            const payload = {
                status: 'DRAFT',
                items: itemsPayload,
                totalAmount: calculateTotal(),
                notes: finalNotes
            }

            const url = isEdit ? `/api/procurement/purchase-orders/${initialData.id}` : '/api/procurement/purchase-orders'
            const method = isEdit ? 'PUT' : 'POST'
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Gagal menyimpan PO')

            toast.success("Purchase Order berhasil disimpan")
            router.push('/admin/procurement/purchase-orders')
        } catch (e: any) {
            console.error(e)
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 p-4 md:p-8">
            {/* Toolbar Action Bar - Outside the Document */}
            <div className="max-w-5xl mx-auto mb-6 flex justify-between items-center sticky top-0 z-40 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur py-2">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.back()}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                        title="Kembali"
                    >
                        <HiArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                            <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                                {isReadOnly ? 'Detail Purchase Order' : isEdit ? 'Edit Purchase Order' : 'Purchase Order Baru'}
                            </h1>
                        <p className="text-xs text-gray-500">
                            {isReadOnly ? `View Mode - #${initialData?.poNumber}` : isEdit ? `PO #${initialData?.poNumber}` : 'Draft Purchase Order'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {!isReadOnly && (
                        <button
                            onClick={handleSubmit}
                            disabled={loading || disabled}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:shadow-none"
                        >
                            <HiSave className="w-5 h-5" />
                            {loading ? 'Menyimpan...' : 'Simpan PO'}
                        </button>
                    )}
                </div>
            </div>

            {/* The Document Paper */}
            <div className="max-w-5xl mx-auto bg-white dark:bg-[#1e1e1e] shadow-2xl rounded-sm overflow-hidden min-h-[800px] print:shadow-none relative">
                {/* Decorative Top Border */}
                <div className="h-2 bg-linear-to-r from-indigo-500 to-purple-600"></div>
                
                <div className="p-8 md:p-12">
                    {/* Document Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start mb-12 border-b border-gray-100 dark:border-gray-800 pb-8">
                        <div>
                            {/* Company Logo Placeholder */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                                    {companyProfile.perusahaan.charAt(0)}
                                </div>
                                <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white uppercase">
                                    {companyProfile.namaAplikasi || 'NETMANAGER'}
                                </span>
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                <p className="font-semibold text-gray-900 dark:text-white uppercase">{companyProfile.perusahaan}</p>
                                <p className="whitespace-pre-line">{companyProfile.alamat}</p>
                                <p>Telp: {companyProfile.nomorHp} | Email: {companyProfile.email}</p>
                            </div>
                        </div>
                        <div className="mt-8 md:mt-0 text-right">
                            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">PURCHASE ORDER</h2>
                            <div className="inline-block text-left bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="text-gray-500 dark:text-gray-400">Date:</div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                        {new Date().toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                                    </div>
                                    <div className="text-gray-500 dark:text-gray-400">PO #:</div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                        {initialData?.poNumber || 'AUTO-GEN'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ship To Grid ONLY (Vendor Deleted) */}
                    <div className="mb-12">
                        {/* Ship To Section - Full Width since Vendor Logic is removed */}
                        <div className="space-y-4 max-w-md">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 pb-2">
                                Ship To
                            </h3>
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-indigo-300 transition-colors">
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    <p className="font-bold text-gray-900 dark:text-white">Gudang Pusat (Default)</p>
                                    <p>Jl. Utama No. 1</p>
                                    <p>Jakarta Selatan, 12345</p>
                                    <p>UP: Bagian Penerimaan Barang</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-12">
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Order Details</h3>
                            {!isReadOnly && (
                                <button
                                    onClick={handleAddItem}
                                    className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
                                >
                                    <HiPlus className="w-4 h-4" /> Add Item
                                </button>
                            )}
                        </div>
                        
                        <div className="border rounded-lg border-gray-200 dark:border-gray-700">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <th className="px-4 py-3 w-[40%]">Item Description</th>
                                        <th className="px-2 py-3 w-[10%] text-center">Qty</th>
                                        <th className="px-2 py-3 w-[10%] text-center">Unit</th>
                                        <th className="px-4 py-3 w-[15%] text-right">Unit Price</th>
                                        <th className="px-4 py-3 w-[20%] text-right">Total</th>
                                        <th className="px-2 py-3 w-[5%]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-[#1e1e1e]">
                                    {items.map((item, index) => (
                                        <tr key={item.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="px-4 py-2 align-top">
                                                {!isReadOnly ? (
                                                    <Combobox
                                                        options={productOptions}
                                                        value={item.barangId}
                                                        onChange={(val) => updateItem(index, 'barangId', val)}
                                                        onSearch={searchProducts}
                                                        loading={loadingProducts}
                                                        placeholder="Select Product..."
                                                        className="w-full"
                                                        disabled={disabled}
                                                    />
                                                ) : (
                                                    <div className="py-2 text-sm font-medium text-gray-900 dark:text-white">
                                                        {item.barangName || productOptions.find(p => p.value === item.barangId)?.label || 'Unknown Product'}
                                                        <div className="text-xs text-gray-500 font-normal">{item.barangId}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-2 py-2 align-top">
                                                {!isReadOnly ? (
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                                                        disabled={disabled}
                                                        className="w-full text-center px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                                                    />
                                                ) : (
                                                    <div className="py-2 text-center text-sm font-medium text-gray-900 dark:text-white">
                                                        {item.quantity}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-2 py-2 text-center text-sm text-gray-500 dark:text-gray-400 align-middle">
                                                {item.satuan || '-'}
                                            </td>
                                            <td className="px-4 py-2 align-top">
                                                {!isReadOnly ? (
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.unitPrice}
                                                            onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))}
                                                            disabled={disabled}
                                                            className="w-full text-right pl-2 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                                                        />
                                                        {item.barangId && (
                                                            <button 
                                                                onClick={() => openMarketPriceModal(index)}
                                                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                                                title="Cek Harga Pasar"
                                                            >
                                                                <HiOutlineTag className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="py-2 text-right text-sm font-medium text-gray-900 dark:text-white">
                                                        {item.unitPrice.toLocaleString('id-ID')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white align-middle">
                                                {(item.quantity * item.unitPrice).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-2 py-2 text-center align-middle">
                                                {!isReadOnly && (
                                                    <button
                                                        onClick={() => handleRemoveItem(index)}
                                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <HiTrash className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-gray-400 italic bg-gray-50/30">
                                                No items added. Please add products to your order.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Footer / Totals */}
                    <div className="flex flex-col md:flex-row justify-between pt-4">
                        <div className="w-full md:w-1/2 mb-8 md:mb-0">
                            <h4 className="font-bold text-gray-900 dark:text-white mb-2">Notes / Terms:</h4>
                            {!isReadOnly ? (
                                <textarea
                                    className="w-full h-24 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Enter notes here..."
                                    disabled={disabled}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            ) : (
                                <div className="p-3 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-sm whitespace-pre-line text-gray-600 dark:text-gray-300">
                                    {notes || '-'}
                                </div>
                            )}
                        </div>
                        <div className="w-full md:w-1/3">
                            <div className="space-y-3 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                                    <span>Subtotal</span>
                                    <span>Rp {calculateTotal().toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                                    <span>Tax (11%)</span>
                                    <span>-</span>
                                </div>
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-bold text-lg text-gray-900 dark:text-white">
                                    <span>Total</span>
                                    <span className="text-indigo-600">Rp {calculateTotal().toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Signature Area */}
                    <div className="mt-16 grid grid-cols-2 gap-12 pt-8 border-t border-gray-100 dark:border-gray-800">
                        <div className="text-center">
                            <div className="h-24 mb-2 flex items-end justify-center">
                                <span className="border-b border-gray-300 dark:border-gray-600 w-3/4 pb-1 text-gray-900 dark:text-white font-medium">
                                    {initialData?.creator?.name || '.........................'}
                                </span>
                            </div>
                            <p className="text-sm font-bold text-gray-600 dark:text-gray-400">Dibuat Oleh</p>
                        </div>
                        <div className="text-center">
                             <div className="h-24 mb-2 flex items-end justify-center">
                                <span className="border-b border-gray-300 dark:border-gray-600 w-3/4 pb-1 text-gray-900 dark:text-white font-medium">
                                    .........................
                                </span>
                            </div>
                            <p className="text-sm font-bold text-gray-600 dark:text-gray-400">Disetujui Oleh</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="max-w-5xl mx-auto mt-8 text-center text-gray-400 text-sm">
                &copy; 2026 PT. Network Solutions internal procurement system.
            </div>

            {/* Market Price Modal */}
            <Modal
                isOpen={isMarketPriceOpen}
                onClose={() => setIsMarketPriceOpen(false)}
                title="Cek Referensi Harga Pasar"
                size="4xl"
            >
                <div className="h-[70vh] overflow-y-auto custom-scrollbar">
                     <MarketPriceCheck 
                         initialKeyword={activeKeyword}
                         onSelectPrice={handleSelectMarketPrice}
                     />
                </div>
            </Modal>
        </div>
    )
}
