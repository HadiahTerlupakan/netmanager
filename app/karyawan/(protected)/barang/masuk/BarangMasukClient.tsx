'use client'

import { useEffect, useState } from 'react'
import { Combobox } from '@/components/ui/Combobox'
import { useRouter } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import { ImageUpload } from '@/components/karyawan/ImageUpload'
import {
    MdArrowBack,
    MdAdd,
    MdRemove,
    MdCheck
} from 'react-icons/md'
import Link from 'next/link'

interface Barang {
    id: string
    kode: string
    nama: string
    satuan: string
}

interface Gudang {
    id: string
    nama: string
}

export default function BarangMasukClient() {
    const { isLoading: authLoading, isAuthenticated } = useKaryawanAuth()
    const [barangs, setBarangs] = useState<Barang[]>([])
    const [gudangs, setGudangs] = useState<Gudang[]>([])
    const [formData, setFormData] = useState({
        barangId: '',
        gudangId: '',
        jumlah: 1,
        kondisi: 'BARU' as 'BARU' | 'BEKAS' | 'RUSAK',
        keterangan: ''
    })
    const [images, setImages] = useState<File[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/karyawan/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        if (isAuthenticated) {
            fetchGudangs()
            fetchBarangs()
        }
    }, [isAuthenticated])

    const fetchGudangs = async () => {
        try {
            const res = await fetch('/api/inventory/gudang', { cache: 'no-store' })
            if (res.ok) {
                const data = await res.json()
                const gudangList = data.gudangs || (Array.isArray(data) ? data : [])
                setGudangs(gudangList)
                if (gudangList.length > 0) {
                    setFormData(prev => ({ ...prev, gudangId: gudangList[0].id }))
                }
            }
        } catch (error) {
            console.error('Failed to fetch gudangs:', error)
        }
    }

    const fetchBarangs = async (query: string = '') => {
        setIsLoading(true)
        try {
            // Use search param and limit to 20 for better performance
            const url = `/api/inventory/barang?limit=20&search=${encodeURIComponent(query)}`
            const res = await fetch(url)

            if (res.ok) {
                const data = await res.json()
                // Fix: Map API response to match Barang interface
                const mappedBarangs = (data.barangs || []).map((b: any) => ({
                    id: b.id,
                    kode: b.kode || '-',
                    nama: b.nama,
                    satuan: b.satuan || 'Pcs',
                    stok: b.totalStock || 0
                }))
                setBarangs(mappedBarangs)
            }
        } catch (error) {
            console.error('Failed to fetch barangs:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const uploadImages = async (): Promise<string[]> => {
        if (images.length === 0) return []
        const urls: string[] = []
        for (const file of images) {
            const data = new FormData()
            data.append('file', file)
            data.append('type', 'barang-masuk')
            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: data
                })
                if (res.ok) {
                    const result = await res.json()
                    urls.push(result.url)
                }
            } catch (error) {
                console.error('Upload failed:', error)
            }
        }
        return urls
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.barangId || !formData.gudangId || formData.jumlah <= 0) {
            alert('Mohon lengkapi data')
            return
        }

        setIsSubmitting(true)
        try {
            const imageUrls = await uploadImages()

            const res = await fetch('/api/inventory/masuk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    buktiFoto: imageUrls
                })
            })

            if (res.ok) {
                setSuccess(true)
                setTimeout(() => router.push('/karyawan/barang'), 2000)
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal menyimpan transakis')
            }
        } catch (error) {
            console.error('Submit error:', error)
            alert('Terjadi kesalahan')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922] p-4 text-center">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                    <MdCheck className="text-4xl text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-[#111418] dark:text-white">Berhasil!</h2>
                <p className="text-gray-500">Barang masuk telah tercatat.</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased">
            <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">
                {/* Header */}
                <div className="sticky top-0 z-20 bg-[#f6f7f8] dark:bg-[#101922] border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center p-4 justify-between">
                        <Link href="/karyawan/barang" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <MdArrowBack className="text-2xl" />
                        </Link>
                        <h2 className="text-lg font-bold leading-tight">Barang Masuk</h2>
                        <div className="w-10" />
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4 pb-24">
                    {/* Gudang */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Gudang</label>
                        <select
                            value={formData.gudangId}
                            onChange={(e) => setFormData({ ...formData, gudangId: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c2936]"
                        >
                            {gudangs.map(g => (
                                <option key={g.id} value={g.id}>{g.nama}</option>
                            ))}
                        </select>
                    </div>

                    {/* Barang Selection */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pilih Barang</label>
                        {isLoading ? (
                            <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                        ) : (
                            <Combobox
                                options={barangs.map(b => ({ value: b.id, label: `${b.nama} (${b.kode})` }))}
                                value={formData.barangId}
                                onChange={(val) => setFormData({ ...formData, barangId: val })}
                                onSearch={fetchBarangs}
                                loading={isLoading}
                                placeholder="Ketik nama atau kode barang..."
                                className="w-full"
                            />
                        )}
                    </div>

                    {/* Quantity Control */}
                    <div className="bg-white dark:bg-[#1c2936] p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">Jumlah Masuk</label>
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, jumlah: Math.max(1, prev.jumlah - 1) }))}
                                className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl hover:bg-gray-200 transition-colors"
                            >
                                <MdRemove />
                            </button>
                            <input
                                type="number"
                                value={formData.jumlah}
                                onChange={(e) => setFormData({ ...formData, jumlah: parseInt(e.target.value) || 0 })}
                                className="w-24 text-center text-2xl font-bold bg-transparent border-none focus:ring-0"
                            />
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, jumlah: prev.jumlah + 1 }))}
                                className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xl hover:bg-blue-200 transition-colors"
                            >
                                <MdAdd />
                            </button>
                        </div>
                    </div>

                    {/* Kondisi */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Kondisi Barang</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['BARU', 'BEKAS', 'RUSAK'].map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, kondisi: k as any })}
                                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${formData.kondisi === k
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-[#1c2936] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                                        }`}
                                >
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>



                    {/* Image Upload */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Foto Bukti (Opsional)</label>
                        <ImageUpload
                            images={images}
                            onImagesChange={setImages}
                            maxImages={3}
                        />
                    </div>

                    {/* Keterangan */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Keterangan Tambahan</label>
                        <textarea
                            value={formData.keterangan}
                            onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c2936]"
                            rows={3}
                            placeholder="Catatan tambahan..."
                        />
                    </div>
                </form>

                {/* Submit Action */}
                <div className="fixed bottom-20 left-0 right-0 p-4 bg-[#f6f7f8] dark:bg-[#101922] border-t border-gray-100 dark:border-gray-800 max-w-md mx-auto z-10">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.barangId}
                        className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <MdCheck className="text-xl" />
                                <span>Simpan Data</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
