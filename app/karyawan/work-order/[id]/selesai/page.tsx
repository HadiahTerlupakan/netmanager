'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import { ImageUpload } from '@/components/karyawan/ImageUpload'
import {
    MdArrowBack,
    MdCheck,
    MdCheckCircle
} from 'react-icons/md'
import Link from 'next/link'

export default function WorkOrderSelesaiPage() {
    const { isLoading: authLoading, isAuthenticated } = useKaryawanAuth()
    const [resolutionNotes, setResolutionNotes] = useState('')
    const [photos, setPhotos] = useState<File[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const router = useRouter()
    const params = useParams()
    const id = params.id as string

    if (!authLoading && !isAuthenticated) {
        router.push('/karyawan/login')
        return null
    }

    const uploadPhotos = async (): Promise<string[]> => {
        if (photos.length === 0) return []

        const uploadedUrls: string[] = []
        for (const photo of photos) {
            const formData = new FormData()
            formData.append('file', photo)
            formData.append('type', 'workorder-completion')
            // Optional: group by work order ID
            formData.append('workOrderId', id)

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                })
                if (res.ok) {
                    const data = await res.json()
                    uploadedUrls.push(data.url)
                }
            } catch (error) {
                console.error('Error uploading photo:', error)
            }
        }
        return uploadedUrls
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            // Upload photos first
            const photoUrls = await uploadPhotos()

            const res = await fetch(`/api/karyawan/work-order/${id}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resolutionNotes,
                    photos: photoUrls
                })
            })

            if (res.ok) {
                setIsSuccess(true)
                setTimeout(() => {
                    router.push('/karyawan/work-order')
                }, 2000)
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal menyelesaikan work order')
            }
        } catch (error) {
            console.error('Error completing work order:', error)
            alert('Terjadi kesalahan')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-[#1c2936] rounded-2xl p-8 shadow-lg text-center max-w-sm w-full">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MdCheckCircle className="text-5xl text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-[#111418] dark:text-white mb-2">
                        Work Order Selesai!
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Mengalihkan ke daftar work order...
                    </p>
                </div>
            </div>
        )
    }

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
                        <Link href={`/karyawan/work-order/${id}`} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <MdArrowBack className="text-2xl" />
                        </Link>
                        <h2 className="text-lg font-bold leading-tight flex-1 text-center pr-10">
                            Selesaikan Work Order
                        </h2>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4">
                    {/* Photo Upload */}
                    <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                        <ImageUpload
                            images={photos}
                            onImagesChange={setPhotos}
                            maxImages={5}
                        />
                        <p className="text-xs text-gray-400 mt-2">
                            * Tambahkan foto hasil pekerjaan sebagai dokumentasi
                        </p>
                    </div>

                    {/* Resolution Notes */}
                    <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                            Catatan Penyelesaian
                        </h3>
                        <textarea
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                            placeholder="Tuliskan detail penyelesaian work order, langkah yang dilakukan, dll..."
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                            rows={4}
                        />
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800/50">
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">
                            <strong>Perhatian:</strong> Setelah diselesaikan, status work order akan menjadi COMPLETED dan tidak bisa dikerjakan lagi.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-green-600 text-white font-bold py-4 px-4 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                    >
                        <MdCheck className="text-xl" />
                        {isSubmitting ? 'Mengupload & Memproses...' : 'Tandai Selesai'}
                    </button>
                </form>
            </div>
        </div>
    )
}
