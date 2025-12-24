'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { MdAdd, MdHistory, MdPending, MdCheckCircle, MdCancel, MdClose, MdCameraAlt } from 'react-icons/md'
import toast from 'react-hot-toast'
import { KaryawanNotificationBell } from '@/components/karyawan/KaryawanNotificationBell'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'

interface LeaveRequest {
    id: string
    type: string
    startDate: string
    endDate: string
    reason: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    attachmentUrl?: string
    rejectionReason?: string
    createdAt: string
}

export default function LeaveClient() {
    const { user } = useKaryawanAuth()
    const [history, setHistory] = useState<LeaveRequest[]>([])
    const [loading, setLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Form States
    const [type, setType] = useState('SAKIT')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [reason, setReason] = useState('')
    const [attachments, setAttachments] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        fetchHistory()
        // Set default date to today
        const today = new Date().toISOString().split('T')[0]
        setStartDate(today)
        setEndDate(today)
    }, [])

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/karyawan/leaves')
            if (res.ok) {
                const data = await res.json()
                setHistory(data)
            }
        } catch (error) { console.error(error) }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error('Hanya boleh upload gambar')
            return
        }

        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'employee-attendance')

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            if (res.ok) {
                const data = await res.json()
                setAttachments(prev => [...prev, data.url])
                toast.success('Gambar berhasil diupload')
            } else {
                const err = await res.json()
                toast.error(err.error || 'Gagal upload gambar')
            }
        } catch (error) {
            console.error(error)
            toast.error('Terjadi kesalahan saat upload')
        } finally {
            setUploading(false)
            // Reset input value to allow uploading same file again
            e.target.value = ''
        }
    }

    const removeAttachment = (indexToRemove: number) => {
        setAttachments(prev => prev.filter((_, index) => index !== indexToRemove))
    }

    const handleSubmit = async () => {
        if (!startDate || !endDate || !reason) {
            toast.error('Mohon lengkapi data')
            return
        }

        if (type !== 'CUTI' && attachments.length === 0) {
            toast.error('Foto bukti wajib diupload')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/karyawan/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, startDate, endDate, reason, attachments })
            })

            if (res.ok) {
                toast.success('Pengajuan berhasil dikirim')
                setIsModalOpen(false)
                setReason('')
                setAttachments([])
                fetchHistory()
            } else {
                const err = await res.json()
                toast.error(err.error)
            }
        } catch (error) {
            toast.error('Gagal mengirim pengajuan')
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'bg-green-100 text-green-700'
            case 'REJECTED': return 'bg-red-100 text-red-700'
            default: return 'bg-yellow-100 text-yellow-700'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'APPROVED': return <MdCheckCircle className="text-xl" />
            case 'REJECTED': return <MdCancel className="text-xl" />
            default: return <MdPending className="text-xl" />
        }
    }

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased pb-24">
            <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">

                {/* Header */}
                <div className="sticky top-0 z-20 flex items-center bg-[#f6f7f8] dark:bg-[#101922] p-4 pb-2 justify-between border-b border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold">Izin & Cuti</h2>
                        <p className="text-xs font-medium text-slate-500">Kelola kehadiran Anda</p>
                    </div>
                    <div className="flex size-10 items-center justify-end">
                        <KaryawanNotificationBell />
                    </div>
                </div>

                {/* Function Row */}
                <div className="p-4">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 flex items-center justify-center gap-2 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                    >
                        <MdAdd className="text-2xl" /> Buat Pengajuan Baru
                    </button>
                </div>

                {/* History List */}
                <div className="px-4 pb-4">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <MdHistory /> Riwayat Pengajuan
                    </h3>
                    <div className="space-y-3">
                        {history.map(item => (
                            <div key={item.id} className="bg-white dark:bg-[#1c2936] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-gray-800">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span className="font-bold text-sm block">{item.type}</span>
                                        <span className="text-xs text-slate-500">
                                            {format(new Date(item.startDate), 'dd MMM yyyy')} - {format(new Date(item.endDate), 'dd MMM yyyy')}
                                        </span>
                                    </div>
                                    <div className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${getStatusColor(item.status)}`}>
                                        {getStatusIcon(item.status)}
                                        {item.status}
                                    </div>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg italic">
                                    "{item.reason}"
                                </p>
                                {item.rejectionReason && (
                                    <p className="text-xs text-red-500 mt-2">
                                        Alasan Penolakan: {item.rejectionReason}
                                    </p>
                                )}
                            </div>
                        ))}
                        {history.length === 0 && (
                            <div className="text-center py-10 text-slate-400">
                                <p>Belum ada riwayat pengajuan.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Form */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-[#1c2936] w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg">Form Pengajuan</h3>
                                <button onClick={() => setIsModalOpen(false)}><MdClose className="text-2xl" /></button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Tipe Izin</label>
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 outline-none"
                                    >
                                        <option value="SAKIT">Sakit</option>
                                        <option value="CUTI">Cuti</option>
                                        <option value="IZIN">Izin</option>
                                        <option value="LAINNYA">Lainnya</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Dari</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Sampai</label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Alasan</label>
                                    <textarea
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        rows={3}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 outline-none"
                                        placeholder="Jelaskan alasan pengajuan..."
                                    />
                                </div>

                                {type !== 'CUTI' && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Foto Bukti (Wajib)</label>
                                        <div className="space-y-3">
                                            {/* Photo Grid */}
                                            {attachments.length > 0 && (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {attachments.map((url, idx) => (
                                                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-gray-700 group">
                                                            <img src={url} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                                                            <button
                                                                onClick={() => removeAttachment(idx)}
                                                                className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <MdClose className="text-xs" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Upload Button */}
                                            <label className={`
                                                relative flex flex-col items-center justify-center w-full 
                                                ${attachments.length > 0 ? 'h-24' : 'h-32'}
                                                border-2 border-dashed rounded-xl cursor-pointer transition-all
                                                border-slate-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800
                                                group
                                            `}>
                                                {uploading ? (
                                                    <div className="flex flex-col items-center gap-2 text-blue-600">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                                        <span className="text-xs font-bold">Mengupload...</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-blue-500 transition-colors">
                                                        <MdCameraAlt className="text-3xl" />
                                                        <span className="text-xs font-bold">
                                                            {attachments.length > 0 ? 'Tambah Foto Lain' : 'Ambil Foto'}
                                                        </span>
                                                    </div>
                                                )}

                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    onChange={handleFileUpload}
                                                    disabled={uploading}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || uploading || (type !== 'CUTI' && attachments.length === 0)}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Mengirim...' : 'Kirim Pengajuan'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
