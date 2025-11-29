"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiArrowLeft,
    HiOutlineHome,
    HiOutlineDocumentText,
    HiOutlineUser,
    HiOutlineInformationCircle,
    HiPaperClip,
    HiXMark,
} from 'react-icons/hi2'

type Category = {
    id: string
    name: string
    description?: string
    color?: string
}

export default function BuatTiketPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])
    const [formData, setFormData] = useState({
        categoryId: '',
        subject: '',
        description: '',
        priority: 'NORMAL',
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('pelanggan_token')
            const pelangganData = localStorage.getItem('pelanggan_data')

            if (!token || !pelangganData) {
                router.push('/pelanggan/login')
                return
            }

            fetchCategories()
        }

        checkAuth()
    }, [router])

    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/pelanggan/tickets/categories')
            if (response.ok) {
                const result = await response.json()
                setCategories(result.data)
            }
        } catch (error) {
            console.error('Error fetching categories:', error)
        }
    }

    const validate = () => {
        const newErrors: Record<string, string> = {}

        if (!formData.subject.trim()) {
            newErrors.subject = 'Judul tiket harus diisi'
        }

        if (!formData.description.trim()) {
            newErrors.description = 'Deskripsi masalah harus diisi'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validate()) {
            return
        }

        setLoading(true)

        try {
            const pelangganData = JSON.parse(localStorage.getItem('pelanggan_data') || '{}')

            const response = await fetch('/api/pelanggan/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'pelanggan-data': JSON.stringify(pelangganData),
                },
                body: JSON.stringify(formData),
            })

            if (response.ok) {
                const result = await response.json()
                router.push(`/pelanggan/bantuan/tiket/${result.data.id}`)
            } else {
                const error = await response.json()
                alert(`Error: ${error.error || 'Gagal membuat tiket'}`)
            }
        } catch (error) {
            console.error('Error creating ticket:', error)
            alert('Terjadi kesalahan. Silakan coba lagi.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
            {/* Header */}
            <header className="bg-gradient-to-r from-sky-400 to-cyan-500 text-white shadow-lg">
                <div className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/pelanggan/bantuan/tiket"
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
                        >
                            <HiArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-xl font-bold">Buat Tiket Baru</h1>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-4 py-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Category */}
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Kategori <span className="text-gray-400">(Opsional)</span>
                        </label>
                        <select
                            value={formData.categoryId}
                            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        >
                            <option value="">Pilih kategori...</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Priority */}
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tingkat Prioritas
                        </label>
                        <select
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        >
                            <option value="LOW">Rendah</option>
                            <option value="NORMAL">Normal</option>
                            <option value="HIGH">Tinggi</option>
                            <option value="URGENT">Mendesak</option>
                        </select>
                    </div>

                    {/* Subject */}
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Judul Tiket <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            placeholder="Misal: Koneksi internet terputus"
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent ${errors.subject ? 'border-red-300' : 'border-gray-300'
                                }`}
                        />
                        {errors.subject && (
                            <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Deskripsi Masalah <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Jelaskan masalah yang Anda alami secara detail..."
                            rows={6}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none ${errors.description ? 'border-red-300' : 'border-gray-300'
                                }`}
                        />
                        {errors.description && (
                            <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                        )}
                        <p className="mt-2 text-xs text-gray-500">
                            Berikan informasi selengkap mungkin agar kami dapat membantu dengan lebih baik
                        </p>
                    </div>

                    {/* Info box */}
                    <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                        <p className="text-sm text-sky-800">
                            <strong>Catatan:</strong> Setelah tiket dibuat, Anda dapat melacak statusnya dan
                            berkomunikasi dengan tim support kami melalui sistem tiket ini.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-sky-500 text-white py-4 rounded-lg font-semibold hover:bg-sky-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-[0.98] touch-manipulation"
                    >
                        {loading ? 'Membuat Tiket...' : 'Kirim Tiket'}
                    </button>
                </form>
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg md:hidden">
                <div className="flex items-center justify-around h-16">
                    <Link
                        href="/pelanggan"
                        className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
                    >
                        <HiOutlineHome className="w-6 h-6" />
                        <span className="text-xs font-medium">Beranda</span>
                    </Link>
                    <Link
                        href="/pelanggan/tagihan"
                        className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
                    >
                        <HiOutlineDocumentText className="w-6 h-6" />
                        <span className="text-xs font-medium">Tagihan</span>
                    </Link>
                    <Link
                        href="/pelanggan/profil"
                        className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
                    >
                        <HiOutlineUser className="w-6 h-6" />
                        <span className="text-xs font-medium">Profil</span>
                    </Link>
                    <Link
                        href="/pelanggan/bantuan"
                        className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-sky-500 touch-manipulation"
                    >
                        <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
                            <HiOutlineInformationCircle className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-medium">Bantuan</span>
                    </Link>
                </div>
            </nav>
        </div>
    )
}
