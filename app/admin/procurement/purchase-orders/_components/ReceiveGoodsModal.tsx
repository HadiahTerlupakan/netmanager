"use client"


import { useState, useEffect } from 'react'

import { Modal, ModalFooter } from '@/components/ui/Modal'
import { HiCheck } from 'react-icons/hi'
import toast from 'react-hot-toast'

interface POItem {
    id: string
    quantity: number
    barang?: {
        nama?: string
        kode?: string
        satuan?: string
    }
}

interface PO {
    id: string
    items?: POItem[]
}

interface ReceiveGoodsModalProps {
    isOpen: boolean
    onClose: () => void
    po: PO | null
    onSuccess: () => void
}

export default function ReceiveGoodsModal({ isOpen, onClose, po, onSuccess }: ReceiveGoodsModalProps) {
    const [loading, setLoading] = useState(false)
    const [quantities, setQuantities] = useState<Record<string, number>>({})
    const [closePO, setClosePO] = useState(true)

    // Initialize quantities with ordered amounts

    useEffect(() => {
        if (po?.items) {
            const initial: Record<string, number> = {}
            po.items.forEach((item: POItem) => {
                initial[item.id] = item.quantity
            })
            setQuantities(initial)
        }
    }, [po])


    const handleQuantityChange = (itemId: string, value: number) => {
        setQuantities(prev => ({
            ...prev,
            [itemId]: value
        }))
    }

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const payload = {
                action: 'RECEIVE',
                items: quantities,
                closePO
            }

            const res = await fetch(`/api/procurement/purchase-orders/${po?.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const json = await res.json()
                throw new Error(json.error || 'Gagal menerima barang')
            }

            toast.success("Barang berhasil diterima & Stok bertambah")
            onSuccess()
            onClose()
        } catch (error: unknown) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : 'Terjadi kesalahan')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Penerimaan Barang (Belanja Selesai)"
            description="Input jumlah barang yang berhasil dibeli. Stok akan bertambah otomatis."
            size="2xl"
        >
            <div className="space-y-6">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm">
                    Pastikan jumlah fisik barang sesuai dengan inputan ini.
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm item-center">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>

                                <th className="px-4 py-3 text-left">Nama Barang</th>
                                <th className="px-4 py-3 text-center">Satuan</th>
                                <th className="px-4 py-3 text-center">Qty Dipesan</th>
                                <th className="px-4 py-3 text-center w-32">Qty Diterima</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {po?.items?.map((item: POItem) => (
                                <tr key={item.id}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900 dark:text-gray-100">
                                            {item.barang?.nama || 'Unknown'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {item.barang?.kode}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-500">
                                        {item.barang?.satuan || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium">
                                        {item.quantity}
                                    </td>
                                    <td className="px-4 py-3">

                                        <input
                                            type="number"
                                            min="0"
                                            value={quantities[item.id] !== undefined ? quantities[item.id] : item.quantity}
                                            onChange={(e) => handleQuantityChange(item.id, e.target.valueAsNumber)}
                                            className="w-full text-center px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />

                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <input
                        type="checkbox"
                        id="closePO"
                        checked={closePO}
                        onChange={(e) => setClosePO(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="closePO" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Tandai PO Selesai (Completed)
                    </label>
                </div>
                {closePO && (
                    <p className="text-xs text-gray-500 ml-6">
                        Jika dicentang, item yang tidak diterima penuh akan dianggap batal (tidak backorder).
                    </p>
                )}
            </div>

            <ModalFooter>
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={loading}
                >
                    Batal
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                    {loading ? 'Menyimpan...' : (
                        <>
                            <HiCheck className="w-4 h-4" />
                            Simpan & Update Stok
                        </>
                    )}
                </button>
            </ModalFooter>
        </Modal>
    )
}
