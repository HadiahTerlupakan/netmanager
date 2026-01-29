"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { HiPlus, HiPencil, HiTrash, HiDocumentText } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { toast } from 'react-hot-toast'

interface TemplateItem {
    id: string
    title: string
    description: string | null
    isMandatory: boolean
    order: number
}

interface Template {
    id: string
    name: string
    description: string
    items: TemplateItem[]
    createdAt: string
    updatedAt: string
}

export default function TemplatesClient() {
    const [templates, setTemplates] = useState<Template[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        fetchTemplates()
    }, [])

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/admin/workorders/templates')
            if (res.ok) {
                const data = await res.json()
                setTemplates(data.data || [])
            }
        } catch (error) {
            console.error('Failed to fetch templates', error)
            toast.error('Gagal memuat template')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus template ini?')) return

        try {
            const res = await fetch(`/api/admin/workorders/templates/${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                toast.success('Template berhasil dihapus')
                fetchTemplates()
            } else {
                toast.error('Gagal menghapus template')
            }
        } catch (error) {
            console.error('Error deleting template', error)
            toast.error('Terjadi kesalahan')
        }
    }

    if (loading) return <PageLoader />

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Work Order Templates</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Kelola template tugas untuk standardisasi pekerjaan.</p>
                </div>
                <Link
                    href="/admin/workorders/templates/new"
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <HiPlus className="w-5 h-5" />
                    Buat Template
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                    <div key={template.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                <HiDocumentText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex gap-2">
                                <Link
                                    href={`/admin/workorders/templates/${template.id}/edit`}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors"
                                >
                                    <HiPencil className="w-5 h-5" />
                                </Link>
                                <button
                                    onClick={() => handleDelete(template.id)}
                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                                >
                                    <HiTrash className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{template.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 flex-1">
                            {template.description}
                        </p>

                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                            <span>{template.items?.length || 0} Tugas</span>
                            <span>{new Date(template.createdAt).toLocaleDateString('id-ID')}</span>
                        </div>
                    </div>
                ))}

                {templates.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <HiDocumentText className="w-12 h-12 mb-3 text-gray-400" />
                        <p>Belum ada template dibuat.</p>
                        <Link href="/admin/workorders/templates/new" className="text-indigo-600 hover:underline mt-2">Buat yang pertama</Link>
                    </div>
                )}
            </div>
        </div>
    )
}
