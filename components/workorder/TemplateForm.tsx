"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiPlus, HiTrash, HiBars3, HiCheck } from 'react-icons/hi2'
import { toast } from 'react-hot-toast'

interface TemplateItem {
    id?: string
    title: string
    description: string
    isMandatory: boolean
    order: number
}

interface TemplateFormData {
    name: string
    description: string
    items: TemplateItem[]
}

interface Props {
    initialData?: TemplateFormData & { id?: string }
    isEdit?: boolean
}

export default function TemplateForm({ initialData, isEdit = false }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<TemplateFormData>(initialData || {
        name: '',
        description: '',
        items: []
    })

    const handleAddItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    title: '',
                    description: '',
                    isMandatory: false,
                    order: prev.items.length
                }
            ]
        }))
    }

    const handleRemoveItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }))
    }

    const handleItemChange = (index: number, field: keyof TemplateItem, value: any) => {
        const newItems = [...formData.items]
        newItems[index] = { ...newItems[index], [field]: value } as TemplateItem
        setFormData({ ...formData, items: newItems })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name) return toast.error('Nama template wajib diisi')
        if (formData.items.length === 0) return toast.error('Minimal harus ada 1 item tugas')

        // Validate items
        for (const item of formData.items) {
            if (!item.title) return toast.error('Semua item tugas harus memiliki judul')
        }

        setLoading(true)
        try {
            const url = isEdit 
                ? `/api/admin/workorders/templates/${initialData?.id}`
                : '/api/admin/workorders/templates'
            
            const method = isEdit ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                toast.success(isEdit ? 'Template berhasil diperbarui' : 'Template berhasil dibuat')
                router.push('/admin/workorders/templates')
                router.refresh()
            } else {
                const err = await res.json()
                toast.error(err.error || 'Gagal menyimpan template')
            }
        } catch (error) {
            console.error('Error saving template', error)
            toast.error('Terjadi kesalahan')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
            {/* Header Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informasi Dasar</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Template <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="Contoh: Instalasi FTTH Baru"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            rows={3}
                            placeholder="Deskripsi singkat tentang template ini..."
                        />
                    </div>
                </div>
            </div>

            {/* Checklist Items */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Daftar Tugas (Checklist)</h2>
                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                        <HiPlus className="w-4 h-4" />
                        Tambah Item
                    </button>
                </div>

                <div className="space-y-4">
                    {formData.items.map((item, index) => (
                        <div key={index} className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 group">
                            <div className="pt-2 text-gray-400 cursor-move">
                                <HiBars3 className="w-5 h-5" />
                            </div>
                            <div className="flex-1 space-y-3">
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={item.title}
                                            onChange={e => handleItemChange(index, 'title', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            placeholder="Judul Tugas"
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={item.isMandatory}
                                            onChange={e => handleItemChange(index, 'isMandatory', e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Wajib
                                    </label>
                                </div>
                                <input
                                    type="text"
                                    value={item.description || ''}
                                    onChange={e => handleItemChange(index, 'description', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="Keterangan tambahan (opsional)"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors h-fit"
                            >
                                <HiTrash className="w-5 h-5" />
                            </button>
                        </div>
                    ))}

                    {formData.items.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                            Belum ada item tugas. Tambahkan item untuk memulai.
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-6 py-2.5 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 font-medium"
                    disabled={loading}
                >
                    Batal
                </button>
                <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm disabled:opacity-50 flex items-center gap-2"
                    disabled={loading}
                >
                    {loading ? 'Menyimpan...' : (
                        <>
                            <HiCheck className="w-5 h-5" />
                            Simpan Template
                        </>
                    )}
                </button>
            </div>
        </form>
    )
}
