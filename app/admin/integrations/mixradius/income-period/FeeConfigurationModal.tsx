'use client'

import { useState, useEffect } from 'react'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { HiPlus, HiTrash } from 'react-icons/hi2'
import toast from 'react-hot-toast'

export interface FeeConfig {
    [method: string]: {
        type: 'FIXED' | 'PERCENT'
        value: number
    }
}

interface FeeConfigurationModalProps {
    isOpen: boolean
    onClose: () => void
    currentFees: FeeConfig
    onSave: (fees: FeeConfig) => Promise<void>
    availableMethods: string[]
}

export default function FeeConfigurationModal({
    isOpen,
    onClose,
    currentFees,
    onSave,
    availableMethods
}: FeeConfigurationModalProps) {
    const [fees, setFees] = useState<FeeConfig>({})
    const [loading, setLoading] = useState(false)
    const [newMethod, setNewMethod] = useState('')

    useEffect(() => {
        setFees(currentFees || {})
    }, [currentFees, isOpen])

    const handleSave = async () => {
        setLoading(true)
        try {
            await onSave(fees)
            onClose()
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const removeFee = (method: string) => {
        const newFees = { ...fees }
        delete newFees[method]
        setFees(newFees)
    }

    const updateFee = (method: string, field: 'type' | 'value', value: string | number) => {
        setFees(prev => ({
            ...prev,
            [method]: {
                ...prev[method],
                [field]: value
            }
        }))
    }

    const addNewMethod = () => {
        if (!newMethod) return
        if (fees[newMethod]) {
            toast.error('Metode sudah ada')
            return
        }
        setFees(prev => ({
            ...prev,
            [newMethod]: { type: 'FIXED', value: 0 }
        }))
        setNewMethod('')
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Konfigurasi Fee Payment Gateway">
            <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded-lg text-sm">
                    Tentukan biaya potongan untuk setiap metode pembayaran agar Pendapatan Bersih dapat dihitung.
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {Object.entries(fees).map(([method, config]) => (
                        <div key={method} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex-1 font-medium text-gray-700 dark:text-gray-200">{method}</div>
                            <select
                                value={config.type}
                                onChange={(e) => updateFee(method, 'type', e.target.value)}
                                className="text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="FIXED">Tetap (Rp)</option>
                                <option value="PERCENT">Persen (%)</option>
                            </select>
                            <input
                                type="number"
                                value={config.value}
                                onChange={(e) => updateFee(method, 'value', parseFloat(e.target.value))}
                                className="w-24 text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="0"
                            />
                            <Button variant="ghost" size="icon-sm" onClick={() => removeFee(method)}>
                                <HiTrash className="w-5 h-5" />
                            </Button>
                        </div>
                    ))}
                    {Object.keys(fees).length === 0 && (
                        <div className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm italic">
                            Belum ada konfigurasi fee. Tambahkan metode pembayaran di bawah.
                        </div>
                    )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                    <div className="relative flex-1">
                         <input
                            type="text"
                            value={newMethod}
                            onChange={(e) => setNewMethod(e.target.value)}
                            placeholder="Nama Metode Baru (misal: VA BCA)"
                            className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            list="available-methods"
                        />
                        <datalist id="available-methods">
                            {availableMethods.filter(m => !fees[m]).map(m => (
                                <option key={m} value={m} />
                            ))}
                        </datalist>
                    </div>

                    <Button
                        variant="secondary"
                        size="icon"
                        onClick={addNewMethod}
                        disabled={!newMethod}
                    >
                        <HiPlus className="w-5 h-5" />
                    </Button>
                </div>
            </div>
            <ModalFooter>
                <Button variant="ghost" onClick={onClose}>Batal</Button>
                <Button loading={loading} onClick={handleSave}>
                    Simpan Konfigurasi
                </Button>
            </ModalFooter>
        </Modal>
    )
}
