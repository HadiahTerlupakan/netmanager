'use client'

import { useEffect, useState } from 'react'
import { Combobox } from '@/components/ui/Combobox'
import { useRouter } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import { ImageUpload } from '@/components/karyawan/ImageUpload'
import {
    MdArrowBack,
    MdRemove,
    MdAdd,
    MdCheck
} from 'react-icons/md'
import Link from 'next/link'

interface Barang {
    id: string
    kode: string
    nama: string
    satuan: string
    stok: number
}

interface Gudang {
    id: string
    nama: string
}

export default function BarangKeluarClient() {
    const { isLoading: authLoading, isAuthenticated } = useKaryawanAuth()
    const [barangs, setBarangs] = useState<Barang[]>([])
    const [gudangs, setGudangs] = useState<Gudang[]>([])
    const [formData, setFormData] = useState({
        barangId: '',
        gudangId: '',
        jumlah: 1,
        kondisi: 'BARU' as 'BARU' | 'BEKAS' | 'RUSAK',
        keterangan: '',
        tujuanPenggunaan: ''
    })
    const [selectedBarang, setSelectedBarang] = useState<Barang | null>(null)
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
        }
    }, [isAuthenticated])

    useEffect(() => {
        if (formData.gudangId) {
            fetchBarangs()
        }
    }, [formData.gudangId])

    const fetchGudangs = async () => {
        try {
            const res = await fetch('/api/inventory/gudang', { cache: 'no-store' })
            if (res.ok) {
                const data = await res.json()
                setGudangs(data.gudangs || [])
            }
        } catch (error) {
            console.error('Failed to fetch gudangs:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchBarangs = async () => {
        try {
            const res = await fetch(`/api/inventory/barang?gudangId=${formData.gudangId}&limit=1000`)
            if (res.ok) {
                const data = await res.json()
                // Fix: Map API response to match Barang interface
                // API returns { ...barang, totalStock, stockPerGudang: [...] }
                const mappedBarangs = (data.barangs || [])
                    .map((b: any) => ({
                        ...b,
                        stok: b.totalStock || 0 // Use totalStock from API as the display stock
                    }))
                    .filter((b: any) => b.stok > 0)
                setBarangs(mappedBarangs)
            }
        } catch (error) {
            console.error('Failed to fetch barangs:', error)
        }
    }

    const handleBarangChange = (barangId: string) => {
        const barang = barangs.find(b => b.id === barangId) || null
        setSelectedBarang(barang)
        setFormData({ ...formData, barangId, jumlah: 1 })
    }

    const uploadImages = async (): Promise<string[]> => {
        if (images.length === 0) return []

        const formDataUpload = new FormData()
        images.forEach(img => formDataUpload.append('photos', img))
        formDataUpload.append('transactionType', 'inventory-keluar')
        formDataUpload.append('transactionId', 'temp-' + Date.now())

        const res = await fetch('/api/inventory/upload-photo', {
            method: 'POST',
            body: formDataUpload
        })

        if (res.ok) {
            const data = await res.json()
            return data.data?.urls || []
        }
        return []
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.barangId || !formData.gudangId || formData.jumlah <= 0) {
            alert('Lengkapi semua field')
            return
        }
        if (selectedBarang && formData.jumlah > selectedBarang.stok) {
            alert('Jumlah melebihi stok')
            return
        }
        setIsSubmitting(true)
        try {
            // Upload images first
            const fotoBukti = await uploadImages()

            const res = await fetch('/api/karyawan/barang/keluar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    fotoBukti
                })
            })
            if (res.ok) {
                setSuccess(true)
                setFormData({
                    barangId: '',
                    gudangId: formData.gudangId,
                    jumlah: 1,
                    kondisi: 'BARU',
                    keterangan: '',
                    tujuanPenggunaan: ''
                })
                setSelectedBarang(null)
                setImages([])
                fetchBarangs()
                setTimeout(() => setSuccess(false), 3000)
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal menyimpan')
            }
        } catch (error) {
            console.error('Failed to submit:', error)
            alert('Terjadi kesalahan')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
                        <h2 className="text-lg font-bold leading-tight">Barang Keluar</h2>
                        <div className="w-10" />
                    </div>
                </div>

                {/* Success Message */}
                {success && (
                    <div className="mx-4 mt-4 p-4 rounded-xl bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 flex items-center gap-3">
                        <MdCheck className="text-2xl text-green-600" />
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">Barang keluar berhasil disimpan!</p>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 pb-32 px-4 pt-4 space-y-4">
                    {/* Gudang */}
                    <div className="z-20 relative">
                        <label className="block text-sm font-medium mb-2">Gudang</label>
                        <Combobox
                            value={formData.gudangId}
                            onChange={(val) => setFormData({ ...formData, gudangId: val, barangId: '' })}
                            options={gudangs.map(g => ({
                                value: g.id,
                                label: g.nama,
                                searchLabel: g.nama
                            }))}
                            placeholder="Silakan Pilih Gudang..."
                        />
                    </div>

                    {/* Barang */}
                    <div className="z-10 relative">
                        <label className="block text-sm font-medium mb-2">Barang</label>
                        <Combobox
                            value={formData.barangId}
                            onChange={(val) => handleBarangChange(val)}
                            options={barangs.map(b => ({
                                value: b.id,
                                label: `${b.kode} - ${b.nama} (Stok: ${b.stok})`,
                                searchLabel: `${b.kode} ${b.nama}`,
                                disabled: b.stok <= 0
                            }))}
                            placeholder="Cari & Pilih Barang"
                            disabled={!formData.gudangId}
                        />
                        {selectedBarang && (
                            <p className="mt-2 text-sm text-gray-500">
                                Stok tersedia: <span className="font-semibold text-green-600">{selectedBarang.stok} {selectedBarang.satuan}</span>
                            </p>
                        )}
                    </div>

                    {/* Jumlah */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Jumlah</label>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, jumlah: Math.max(1, formData.jumlah - 1) })}
                                className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
                            >
                                <MdRemove className="text-xl" />
                            </button>
                            <input
                                type="number"
                                value={formData.jumlah}
                                onChange={(e) => setFormData({ ...formData, jumlah: parseInt(e.target.value) || 1 })}
                                className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-[#1c2936] border border-gray-200 dark:border-gray-700 text-center text-lg font-bold"
                                min="1"
                                max={selectedBarang?.stok || 999}
                            />
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, jumlah: Math.min((selectedBarang?.stok || 999), formData.jumlah + 1) })}
                                className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
                            >
                                <MdAdd className="text-xl" />
                            </button>
                        </div>
                    </div>

                    {/* Kondisi */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Kondisi</label>
                        <div className="flex gap-2">
                            {(['BARU', 'BEKAS', 'RUSAK'] as const).map(k => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, kondisi: k })}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${formData.kondisi === k
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-[#1c2936] border border-gray-200 dark:border-gray-700'
                                        }`}
                                >
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Image Upload */}
                    <ImageUpload
                        images={images}
                        onImagesChange={setImages}
                        maxImages={5}
                    />

                    {/* Tujuan Penggunaan */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Tujuan Penggunaan</label>
                        <input
                            type="text"
                            value={formData.tujuanPenggunaan}
                            onChange={(e) => setFormData({ ...formData, tujuanPenggunaan: e.target.value })}
                            placeholder="Untuk keperluan apa?"
                            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1c2936] border border-gray-200 dark:border-gray-700"
                        />
                    </div>

                    {/* Keterangan */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Keterangan (Opsional)</label>
                        <textarea
                            value={formData.keterangan}
                            onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                            placeholder="Catatan tambahan..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1c2936] border border-gray-200 dark:border-gray-700 resize-none"
                        />
                    </div>
                </form>

                {/* Submit Button */}
                <div className="fixed bottom-20 left-0 right-0 p-4 bg-[#f6f7f8] dark:bg-[#101922] border-t border-gray-100 dark:border-gray-800 max-w-md mx-auto">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.barangId || !formData.gudangId || !!(selectedBarang && formData.jumlah > selectedBarang.stok)}
                        className="w-full bg-orange-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <MdRemove className="text-xl" />
                        {isSubmitting ? 'Menyimpan...' : 'Simpan Barang Keluar'}
                    </button>
                </div>
            </div>
        </div>
    )
}
