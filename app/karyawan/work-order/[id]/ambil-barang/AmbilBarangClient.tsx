'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import {
    MdArrowBack,
    MdSearch,
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
    stok: number
}

interface Gudang {
    id: string
    nama: string
}

interface SelectedItem {
    barangId: string
    barang: Barang
    gudangId: string
    jumlah: number
    kondisi: 'BARU' | 'BEKAS' | 'RUSAK'
}

export default function AmbilBarangClient() {
    const { isLoading: authLoading, isAuthenticated } = useKaryawanAuth()
    const [barangs, setBarangs] = useState<Barang[]>([])
    const [gudangs, setGudangs] = useState<Gudang[]>([])
    const [selectedGudang, setSelectedGudang] = useState('')
    const [search, setSearch] = useState('')
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()
    const params = useParams()
    const workOrderId = params.id as string

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
        if (selectedGudang) {
            fetchBarangs()
        }
    }, [selectedGudang])

    const fetchGudangs = async () => {
        try {
            const res = await fetch('/api/karyawan/gudang')
            if (res.ok) {
                const data = await res.json()
                console.log('Gudangs fetched:', data)
                setGudangs(data.gudangList || [])
                if (data.gudangList?.length > 0) {
                    setSelectedGudang(data.gudangList[0].id)
                } else {
                    // No gudang available, stop loading
                    setIsLoading(false)
                }
            } else {
                console.error('Failed to fetch gudangs:', res.status)
                setIsLoading(false)
            }
        } catch (error) {
            console.error('Failed to fetch gudangs:', error)
            setIsLoading(false)
        }
    }

    const fetchBarangs = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/karyawan/barang?gudangId=${selectedGudang}`)
            if (res.ok) {
                const data = await res.json()
                setBarangs(data.barangList || [])
            }
        } catch (error) {
            console.error('Failed to fetch barangs:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const addItem = (barang: Barang) => {
        const existing = selectedItems.find(i => i.barangId === barang.id)
        if (existing) {
            if (existing.jumlah < barang.stok) {
                setSelectedItems(items =>
                    items.map(i =>
                        i.barangId === barang.id
                            ? { ...i, jumlah: i.jumlah + 1 }
                            : i
                    )
                )
            }
        } else {
            setSelectedItems([...selectedItems, {
                barangId: barang.id,
                barang,
                gudangId: selectedGudang,
                jumlah: 1,
                kondisi: 'BARU'
            }])
        }
    }

    const updateQuantity = (barangId: string, delta: number) => {
        setSelectedItems(items =>
            items.map(i => {
                if (i.barangId === barangId) {
                    const newQty = i.jumlah + delta
                    if (newQty <= 0) return i
                    if (newQty > i.barang.stok) return i
                    return { ...i, jumlah: newQty }
                }
                return i
            }).filter(i => i.jumlah > 0)
        )
    }

    const removeItem = (barangId: string) => {
        setSelectedItems(items => items.filter(i => i.barangId !== barangId))
    }

    const handleSubmit = async () => {
        if (selectedItems.length === 0) return
        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/karyawan/work-order/${workOrderId}/barang`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: selectedItems.map(i => ({
                        barangId: i.barangId,
                        gudangId: i.gudangId,
                        jumlah: i.jumlah,
                        kondisi: i.kondisi
                    }))
                })
            })
            if (res.ok) {
                router.push(`/karyawan/work-order/${workOrderId}`)
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

    const filteredBarangs = barangs.filter(b =>
        b.nama.toLowerCase().includes(search.toLowerCase()) ||
        b.kode.toLowerCase().includes(search.toLowerCase())
    )

    if (authLoading) {
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
                        <Link href={`/karyawan/work-order/${workOrderId}`} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <MdArrowBack className="text-2xl" />
                        </Link>
                        <h2 className="text-lg font-bold leading-tight">Ambil Barang</h2>
                        <div className="w-10" />
                    </div>

                    {/* Gudang Selector */}
                    <div className="px-4 pb-3">
                        <select
                            value={selectedGudang}
                            onChange={(e) => setSelectedGudang(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-[#1c2936] border border-gray-200 dark:border-gray-700 text-sm font-medium"
                        >
                            {gudangs.map(g => (
                                <option key={g.id} value={g.id}>{g.nama}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search */}
                    <div className="px-4 pb-3">
                        <div className="relative">
                            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari barang..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-[#1c2936] border border-gray-200 dark:border-gray-700 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Selected Items */}
                {selectedItems.length > 0 && (
                    <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                            Barang Dipilih ({selectedItems.length})
                        </h3>
                        <div className="space-y-2">
                            {selectedItems.map(item => (
                                <div key={item.barangId} className="flex items-center justify-between bg-white dark:bg-[#1c2936] rounded-lg p-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium dark:text-white truncate">{item.barang.nama}</p>
                                        <p className="text-xs text-gray-500">{item.barang.satuan}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateQuantity(item.barangId, -1)}
                                            className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                                        >
                                            <MdRemove className="text-sm" />
                                        </button>
                                        <span className="w-8 text-center font-semibold">{item.jumlah}</span>
                                        <button
                                            onClick={() => updateQuantity(item.barangId, 1)}
                                            className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                                        >
                                            <MdAdd className="text-sm" />
                                        </button>
                                        <button
                                            onClick={() => removeItem(item.barangId)}
                                            className="ml-2 text-red-500 text-xs font-medium"
                                        >
                                            Hapus
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Barang List */}
                <div className="flex-1 pb-32 px-4 pt-4">
                    {gudangs.length === 0 && !isLoading ? (
                        <div className="text-center py-12 text-gray-500">
                            <p className="font-medium">Tidak ada gudang tersedia</p>
                            <p className="text-sm mt-1">Hubungi admin untuk menambahkan gudang</p>
                        </div>
                    ) : isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredBarangs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            Tidak ada barang ditemukan
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredBarangs.map(barang => {
                                const selected = selectedItems.find(i => i.barangId === barang.id)
                                return (
                                    <div
                                        key={barang.id}
                                        className={`bg-white dark:bg-[#1c2936] rounded-xl p-4 border transition-colors ${selected
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-100 dark:border-gray-800'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-gray-500 font-mono">{barang.kode}</p>
                                                <p className="font-medium dark:text-white truncate">{barang.nama}</p>
                                                <p className="text-sm text-gray-500">
                                                    Stok: <span className={barang.stok > 0 ? 'text-green-600' : 'text-red-500'}>{barang.stok}</span> {barang.satuan}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => addItem(barang)}
                                                disabled={barang.stok <= 0 || (selected && selected.jumlah >= barang.stok)}
                                                className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-50 disabled:bg-gray-300"
                                            >
                                                <MdAdd className="text-xl" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                {selectedItems.length > 0 && (
                    <div className="fixed bottom-20 left-0 right-0 p-4 bg-[#f6f7f8] dark:bg-[#101922] border-t border-gray-100 dark:border-gray-800 max-w-md mx-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <MdCheck className="text-xl" />
                            {isSubmitting ? 'Menyimpan...' : `Simpan (${selectedItems.reduce((acc, i) => acc + i.jumlah, 0)} item)`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
