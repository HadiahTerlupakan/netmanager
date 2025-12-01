"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiX } from 'react-icons/hi2'

interface TaxRecordModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

const TAX_TYPES = [
    { value: 'PPN_IN', label: 'PPN IN (Masukan)' },
    { value: 'PPN_OUT', label: 'PPN OUT (Keluaran)' },
    { value: 'PPH_21', label: 'PPh Pasal 21 (Gaji)' },
    { value: 'PPH_23', label: 'PPh Pasal 23 (Jasa)' },
    { value: 'PPH_4_2', label: 'PPh Pasal 4(2) (Sewa)' },
]

export default function TaxRecordModal({ isOpen, onClose, onSuccess }: TaxRecordModalProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        taxType: 'PPN_OUT',
        taxPeriod: new Date().getMonth() + 1,
        taxYear: new Date().getFullYear(),
        taxableAmount: '',
        notes: '',
    })

    const [calculatedTax, setCalculatedTax] = useState<any>(null)

    const handleCalculate = async () => {
        if (!formData.taxableAmount || parseFloat(formData.taxableAmount) <= 0) {
            alert('Please enter a valid taxable amount')
            return
        }

        try {
            const response = await fetch('/api/finance/tax/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taxType: formData.taxType,
                    taxableAmount: formData.taxableAmount,
                }),
            })

            if (response.ok) {
                const data = await response.json()
                setCalculatedTax(data)
            } else {
                alert('Failed to calculate tax')
            }
        } catch (error) {
            console.error('Error calculating tax:', error)
            alert('Error calculating tax')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.taxableAmount || parseFloat(formData.taxableAmount) <= 0) {
            alert('Please enter a valid taxable amount')
            return
        }

        setLoading(true)

        try {
            const response = await fetch('/api/finance/tax/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            if (response.ok) {
                alert('Tax record created successfully!')
                onClose()
                if (onSuccess) {
                    onSuccess()
                }
                // Reset form
                setFormData({
                    taxType: 'PPN_OUT',
                    taxPeriod: new Date().getMonth() + 1,
                    taxYear: new Date().getFullYear(),
                    taxableAmount: '',
                    notes: '',
                })
                setCalculatedTax(null)
            } else {
                const error = await response.json()
                alert(`Failed to create tax record: ${error.message || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Error creating tax record:', error)
            alert('Error creating tax record')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    const formatRupiah = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 md:p-4 safe-area-inset-top safe-area-inset-bottom">
            <div className="bg-white dark:bg-gray-800 rounded-none md:rounded-xl shadow-xl max-w-lg w-full h-full md:h-auto md:max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white pr-4">Add Tax Record</h2>
                    <button
                        onClick={onClose}
                        className="touch-target p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                        aria-label="Tutup"
                    >
                        <HiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 md:space-y-5 flex-1 overflow-y-auto">
                    {/* Tax Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tax Type
                        </label>
                        <select
                            value={formData.taxType}
                            onChange={(e) => {
                                setFormData({ ...formData, taxType: e.target.value })
                                setCalculatedTax(null)
                            }}
                            className="w-full px-3 md:px-4 py-3 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            required
                        >
                            {TAX_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Period */}
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Month
                            </label>
                            <select
                                value={formData.taxPeriod}
                                onChange={(e) => setFormData({ ...formData, taxPeriod: parseInt(e.target.value) })}
                                className="w-full px-3 md:px-4 py-3 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                required
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                    <option key={month} value={month}>
                                        {month}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Year
                            </label>
                            <input
                                type="number"
                                value={formData.taxYear}
                                onChange={(e) => setFormData({ ...formData, taxYear: parseInt(e.target.value) })}
                                className="w-full px-3 md:px-4 py-3 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                required
                            />
                        </div>
                    </div>

                    {/* Taxable Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            DPP (Taxable Amount)
                        </label>
                        <input
                            type="number"
                            value={formData.taxableAmount}
                            onChange={(e) => {
                                setFormData({ ...formData, taxableAmount: e.target.value })
                                setCalculatedTax(null)
                            }}
                            placeholder="e.g., 10000000"
                            className="w-full px-3 md:px-4 py-3 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Calculate Button */}
                    <button
                        type="button"
                        onClick={handleCalculate}
                        className="touch-target w-full px-4 py-3 bg-blue-600 text-white text-base md:text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Calculate Tax
                    </button>

                    {/* Calculated Tax Display */}
                    {calculatedTax && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">DPP:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {formatRupiah(parseInt(calculatedTax.taxableAmount))}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Tax Rate:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {(calculatedTax.taxRate * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="flex justify-between border-t border-emerald-300 dark:border-emerald-700 pt-2">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Tax Amount:</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatRupiah(parseInt(calculatedTax.taxAmount))}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{calculatedTax.details}</p>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Notes (Optional)
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full px-3 md:px-4 py-3 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                            placeholder="Additional notes..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col md:flex-row gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="touch-target flex-1 px-4 py-3 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="touch-target flex-1 px-4 py-3 text-base md:text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating...' : 'Create Tax Record'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
