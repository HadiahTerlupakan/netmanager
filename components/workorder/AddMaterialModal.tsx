"use client"

import { useState, useEffect } from 'react'
import { HiMagnifyingGlass, HiCube, HiCheck } from 'react-icons/hi2'
import { Button } from '@/components/ui/Button'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { toast } from 'react-hot-toast'
import { useDebounce } from '@/hooks/useDebounce'

interface AddMaterialModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    workOrderId: string
}

interface Barang {
    id: string
    kode: string
    nama: string
    satuan: string
    totalStock: number
}

export default function AddMaterialModal({ isOpen, onClose, onSuccess, workOrderId }: AddMaterialModalProps) {
    const [step, setStep] = useState<1 | 2>(1)
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [items, setItems] = useState<Barang[]>([])
    const [searching, setSearching] = useState(false)
    
    // Selection state
    const [selectedItem, setSelectedItem] = useState<Barang | null>(null)
    const [quantity, setQuantity] = useState(1)
    const [notes, setNotes] = useState('')

    const debouncedSearch = useDebounce(search, 500)

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setStep(1)
            setSearch('')
            setSelectedItem(null)
            setQuantity(1)
            setNotes('')
            fetchItems('')
        }
    }, [isOpen])

    // Search effect
    useEffect(() => {
        if (isOpen) {
            fetchItems(debouncedSearch)
        }
    }, [debouncedSearch, isOpen])

    const fetchItems = async (query: string) => {
        setSearching(true)
        try {
            // Reusing the inventory API
            const res = await fetch(`/api/inventory/barang?search=${query}&limit=20`)
            if (res.ok) {
                const data = await res.json() as { data?: { barangs?: Barang[] } | Barang[] }
                // Handle different response structures if necessary, assuming standardized response
                const list = (Array.isArray(data.data) ? data.data : data.data?.barangs) || []
                setItems(list)
            }
        } catch (error: unknown) {
            console.error('Error fetching items:', error)
        } finally {
            setSearching(false)
        }
    }

    const handleSelect = (item: Barang) => {
        if (item.totalStock <= 0) {
            toast.error('Stok barang habis')
            return
        }
        setSelectedItem(item)
        setStep(2)
    }

    const handleSubmit = async () => {
        if (!selectedItem) return
        if (quantity <= 0) {
            toast.error('Jumlah harus lebih dari 0')
            return
        }
        if (quantity > selectedItem.totalStock) {
            toast.error(`Stok tidak mencukupi (Tersedia: ${selectedItem.totalStock})`)
            return
        }

        setLoading(true)
        try {
            const res = await fetch(`/api/admin/workorders/${workOrderId}/materials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barangId: selectedItem.id,
                    quantity: quantity,
                    notes: notes
                })
            })

            if (res.ok) {
                toast.success('Material berhasil ditambahkan')
                onSuccess()
                onClose()
            } else {
                const err = await res.json() as { error?: string }
                toast.error(err.error || 'Gagal menambahkan material')
            }
        } catch (error: unknown) {
            console.error('Error adding material:', error)
            toast.error('Terjadi kesalahan')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Tambah Material / Sparepart"
            size="lg"
        >
            <div className="p-6">
                {step === 1 ? (
                    <div className="space-y-4">
                        {/* Search Bar */}
                        <div className="relative">
                            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari nama barang atau kode..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                autoFocus
                            />
                        </div>

                        {/* List */}
                        <div className="h-[400px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                            {searching ? (
                                <div className="flex justify-center items-center h-full text-gray-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : items.length > 0 ? (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {items.map((item) => (
                                        <Button
                                            key={item.id}
                                            onClick={() => handleSelect(item)}
                                            disabled={item.totalStock <= 0}
                                            className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between group transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                                    item.totalStock > 0 
                                                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' 
                                                        : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                                }`}>
                                                    <HiCube className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                        {item.nama}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        Kode: {item.kode}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-semibold ${item.totalStock > 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'}`}>
                                                    {item.totalStock} {item.satuan}
                                                </div>
                                                <div className="text-xs text-gray-500">Stok Tersedia</div>
                                            </div>
                                        </Button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <HiCube className="w-12 h-12 mb-2 text-gray-300" />
                                    <p>Barang tidak ditemukan</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Step 2: Quantity & Notes */
                    <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                <HiCube className="w-7 h-7" />
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white text-lg">{selectedItem?.nama}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Kode: {selectedItem?.kode} • Stok: {selectedItem?.totalStock} {selectedItem?.satuan}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Jumlah ({selectedItem?.satuan}) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max={selectedItem?.totalStock}
                                    value={quantity}
                                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg font-medium"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Maksimal: {selectedItem?.totalStock}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Catatan (Opsional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Keterangan penggunaan..."
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-[86px] resize-none"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <ModalFooter>
                {step === 2 ? (
                    <>
                        <Button
                            onClick={() => setStep(1)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            disabled={loading}
                        >
                            Kembali
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading}
                            
                        >
                            {loading ? (
                                'Menyimpan...'
                            ) : (
                                <>
                                    <HiCheck className="w-5 h-5" />
                                    Simpan
                                </>
                            )}
                        </Button>
                    </>
                ) : (
                    <Button variant="secondary"
                        onClick={onClose}
                        
                    >
                        Tutup
                    </Button>
                )}
            </ModalFooter>
        </Modal>
    )
}
