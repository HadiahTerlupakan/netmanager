'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCustomerAuth } from '@/components/customer/CustomerAuthProvider'
import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'
import {
    MdSearch,
    MdCall,
    MdMail,
    MdCheckCircle,
    MdConfirmationNumber,
    MdExpandMore,
    MdChevronRight,
    MdChat,
    MdEditSquare,
    MdClose,
    MdWarning
} from 'react-icons/md'

interface Ticket {
    id: string
    ticketNumber: string
    subject: string
    status: string
    updatedAt: string
    _count: {
        replies: number
    }
}

export default function CustomerSupportPage() {
    const { isLoading: authLoading, isAuthenticated, customer } = useCustomerAuth()
    const router = useRouter()

    // Data State
    const [latestTicket, setLatestTicket] = useState<Ticket | null>(null)
    const [loadingTicket, setLoadingTicket] = useState(true)

    // Form State
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [category, setCategory] = useState('')
    const [subject, setSubject] = useState('')
    const [description, setDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')
    const [ticketNumber, setTicketNumber] = useState('')

    // Fetch Latest Ticket
    useEffect(() => {
        if (!isAuthenticated) return

        const fetchLatestTicket = async () => {
            try {
                const res = await fetch('/api/customer/tickets?limit=1')
                const data = await res.json()
                if (res.ok && data.success && data.tickets.length > 0) {
                    setLatestTicket(data.tickets[0])
                }
            } catch (err) {
                console.error('Failed to fetch latest ticket', err)
            } finally {
                setLoadingTicket(false)
            }
        }

        fetchLatestTicket()
    }, [isAuthenticated])

    // Auth Redirect
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
        }
    }, [authLoading, isAuthenticated, router])

    const handleSubmit = async () => {
        if (!category || !subject || !description) {
            setError('Silakan lengkapi semua field')
            return
        }

        setSubmitting(true)
        setError('')

        try {
            const res = await fetch('/api/customer/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: category.toUpperCase(),
                    subject,
                    description,
                }),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setSuccess(true)
                setTicketNumber(data.ticket.ticketNumber)
                setCategory('')
                setSubject('')
                setDescription('')
                // Refresh latest ticket
                setLatestTicket({ ...data.ticket, status: 'OPEN', _count: { replies: 0 } })
            } else {
                setError(data.error || 'Gagal membuat tiket')
            }
        } catch (_err) {
            setError('Terjadi kesalahan. Silakan coba lagi.')
        } finally {
            setSubmitting(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OPEN': return 'text-blue-500 bg-blue-500/10 ring-blue-500/20'
            case 'IN_PROGRESS': return 'text-amber-500 bg-amber-500/10 ring-amber-500/20'
            case 'WAITING_CUSTOMER': return 'text-purple-500 bg-purple-500/10 ring-purple-500/20'
            case 'RESOLVED': return 'text-teal-500 bg-teal-500/10 ring-teal-500/20'
            case 'CLOSED': return 'text-gray-500 bg-gray-500/10 ring-gray-500/20'
            default: return 'text-gray-500 bg-gray-500/10 ring-gray-500/20'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'OPEN': return 'Baru'
            case 'IN_PROGRESS': return 'Sedang Dikerjakan'
            case 'WAITING_CUSTOMER': return 'Menunggu Anda'
            case 'RESOLVED': return 'Selesai Dikerjakan'
            case 'CLOSED': return 'Ditutup'
            default: return status
        }
    }

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#101922]">
                <div className="w-10 h-10 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="bg-gray-50 dark:bg-[#101622] font-sans text-slate-900 dark:text-white min-h-screen pb-24">
            <style jsx global>{`
                details > summary { list-style: none; }
                details > summary::-webkit-details-marker { display: none; }
                details[open] summary ~ * { animation: sweep .3s ease-in-out; }
                @keyframes sweep { 0% {opacity: 0; transform: translateY(-10px)} 100% {opacity: 1; transform: translateY(0)} }
            `}</style>

            <div className="relative flex flex-col w-full max-w-md mx-auto bg-white dark:bg-[#101622] min-h-screen shadow-2xl overflow-x-hidden">

                {/* Header */}
                <header className="sticky top-0 z-40 flex items-center justify-between bg-white/80 dark:bg-[#101622]/90 px-5 py-4 backdrop-blur-md border-b border-gray-100 dark:border-gray-800/50">
                    <h1 className="text-xl font-extrabold tracking-tight text-[#0d9488]">Dukungan</h1>
                    <div className="relative overflow-hidden rounded-full p-0.5 ring-2 ring-[#0d9488]/20 transition-all hover:ring-[#0d9488]">
                        <Link href="/profil" className="block h-9 w-9 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div className="flex items-center justify-center h-full w-full text-slate-500 dark:text-slate-400">
                                <span className="font-bold text-sm">{customer?.nama?.charAt(0) || 'U'}</span>
                            </div>
                        </Link>
                    </div>
                </header>

                {/* Search Section */}
                <div className="px-5 pt-4 pb-6">
                    <h2 className="mb-4 text-3xl font-bold leading-tight text-slate-900 dark:text-white">
                        Apa yang bisa <br /><span className="text-[#0d9488]">kami bantu?</span>
                    </h2>
                    <div className="group flex items-center rounded-2xl bg-white dark:bg-[#1c2333] px-4 py-3 shadow-sm ring-1 ring-slate-200 dark:ring-white/5 focus-within:ring-2 focus-within:ring-[#0d9488] transition-all">
                        <MdSearch className="text-slate-400 group-focus-within:text-[#0d9488] mr-3 text-2xl" />
                        <input
                            className="w-full bg-transparent border-none p-0 text-base font-medium placeholder-slate-400 focus:ring-0 text-slate-900 dark:text-white"
                            placeholder="Cari topik bantuan..."
                            type="text"
                        />
                    </div>
                </div>

                {/* Ticket History Widget */}
                <div className="px-5 mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold">Tiket Terakhir</h3>
                        <Link href="/dukungan/riwayat" className="text-sm font-semibold text-[#0d9488] hover:text-teal-600">
                            Lihat Semua
                        </Link>
                    </div>

                    {!loadingTicket && latestTicket ? (
                        <Link href={`/dukungan/${latestTicket.id}`}>
                            <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#1c2333] p-5 shadow-sm ring-1 ring-slate-200 dark:ring-white/5 hover:ring-[#0d9488]/50 transition-all group cursor-pointer">
                                {/* Status Pill */}
                                <div className="absolute top-5 right-5">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${getStatusColor(latestTicket.status)}`}>
                                        {getStatusLabel(latestTicket.status)}
                                    </span>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0d9488]/10 text-[#0d9488]">
                                        <MdConfirmationNumber className="text-2xl" />
                                    </div>
                                    <div className="flex flex-col pr-20">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">#{latestTicket.ticketNumber}</span>
                                        <h4 className="text-base font-bold leading-snug text-slate-900 dark:text-white line-clamp-1">{latestTicket.subject}</h4>
                                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                            Update: {latestTicket.updatedAt && !isNaN(new Date(latestTicket.updatedAt).getTime())
                                                ? formatDistanceToNow(new Date(latestTicket.updatedAt), { addSuffix: true, locale: id })
                                                : '-'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ) : (
                        <div className="rounded-2xl bg-white dark:bg-[#1c2333] p-6 text-center shadow-sm ring-1 ring-slate-200 dark:ring-white/5">
                            <p className="text-sm text-gray-500">Belum ada tiket yang dibuat.</p>
                        </div>
                    )}
                </div>

                {/* FAQs Section */}
                <div className="px-5 mb-8">
                    <h3 className="text-lg font-bold mb-3">Pertanyaan Populer</h3>
                    <div className="space-y-3">
                        {/* FAQ 1 */}
                        <details className="group overflow-hidden rounded-xl bg-white dark:bg-[#1c2333] shadow-sm ring-1 ring-slate-200 dark:ring-white/5">
                            <summary className="flex w-full items-center justify-between p-4 text-left cursor-pointer">
                                <span className="font-semibold text-slate-900 dark:text-white group-open:text-[#0d9488]">Bagaimana cara bayar tagihan?</span>
                                <MdExpandMore className="text-slate-400 group-open:rotate-180 transition-transform text-2xl" />
                            </summary>
                            <div className="px-4 pb-4 pt-0 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                Anda dapat membayar tagihan melalui menu &quot;Tagihan&quot; di aplikasi ini, kemudian ikuti instruksi pembayaran via Transfer Bank atau QRIS.
                            </div>
                        </details>

                        {/* FAQ 2 */}
                        <details className="group overflow-hidden rounded-xl bg-white dark:bg-[#1c2333] shadow-sm ring-1 ring-slate-200 dark:ring-white/5">
                            <summary className="flex w-full items-center justify-between p-4 text-left cursor-pointer">
                                <span className="font-semibold text-slate-900 dark:text-white group-open:text-[#0d9488]">Internet saya lambat, kenapa?</span>
                                <MdExpandMore className="text-slate-400 group-open:rotate-180 transition-transform text-2xl" />
                            </summary>
                            <div className="px-4 pb-4 pt-0 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                Coba restart modem Anda dengan mematikannya selama 1 menit lalu nyalakan kembali. Jika masalah berlanjut, buat tiket bantuan teknis.
                            </div>
                        </details>

                        {/* FAQ 3 */}
                        <details className="group overflow-hidden rounded-xl bg-white dark:bg-[#1c2333] shadow-sm ring-1 ring-slate-200 dark:ring-white/5">
                            <summary className="flex w-full items-center justify-between p-4 text-left cursor-pointer">
                                <span className="font-semibold text-slate-900 dark:text-white group-open:text-[#0d9488]">Cara ganti password wifi?</span>
                                <MdExpandMore className="text-slate-400 group-open:rotate-180 transition-transform text-2xl" />
                            </summary>
                            <div className="px-4 pb-4 pt-0 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                Saat ini penggantian password wifi harus dilakukan melalui Admin. Silakan buat tiket dengan kategori &quot;Lainnya&quot; untuk permintaan ini.
                            </div>
                        </details>
                    </div>
                </div>

                {/* Contact Options */}
                <div className="px-5 mb-24">
                    <h3 className="text-lg font-bold mb-4">Hubungi Kami</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Chat */}
                        <button className="col-span-1 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white dark:bg-[#1c2333] p-6 shadow-sm ring-1 ring-slate-200 dark:ring-white/5 transition-all active:scale-95 hover:ring-[#0d9488]/50 group">
                            <div className="rounded-full bg-blue-500/10 p-3 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <MdChat className="text-[28px]" />
                            </div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">Live Chat</span>
                        </button>
                        {/* Email */}
                        <a href="mailto:support@netmanager.id" className="col-span-1 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white dark:bg-[#1c2333] p-6 shadow-sm ring-1 ring-slate-200 dark:ring-white/5 transition-all active:scale-95 hover:ring-[#0d9488]/50 group">
                            <div className="rounded-full bg-purple-500/10 p-3 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                <MdMail className="text-[28px]" />
                            </div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">Email Kami</span>
                        </a>
                        {/* Phone */}
                        <a href="tel:08001234567" className="col-span-2 flex items-center justify-between rounded-2xl bg-white dark:bg-[#1c2333] p-4 pl-6 shadow-sm ring-1 ring-slate-200 dark:ring-white/5 transition-all active:scale-95 hover:ring-[#0d9488]/50 group">
                            <div className="flex items-center gap-4">
                                <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                    <MdCall className="text-[24px]" />
                                </div>
                                <div className="text-left">
                                    <span className="block text-sm font-bold text-slate-900 dark:text-white">Call Center</span>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">08:00 - 17:00 WIB</span>
                                </div>
                            </div>
                            <MdChevronRight className="text-slate-400 text-2xl pr-2" />
                        </a>
                        {/* Create Ticket Button */}
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="col-span-2 mt-2 flex items-center justify-center gap-2 rounded-2xl bg-[#0d9488] py-4 text-white shadow-lg shadow-[#0d9488]/30 transition-all hover:bg-teal-600 active:scale-[0.98]"
                        >
                            <MdEditSquare className="text-xl" />
                            <span className="text-base font-bold">Buat Tiket Baru</span>
                        </button>
                    </div>
                </div>

                {/* Create Ticket Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="w-full max-w-sm bg-white dark:bg-[#1c2333] rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Buat Tiket Baru</h3>
                                <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                                    <MdClose className="text-2xl text-gray-500" />
                                </button>
                            </div>

                            <div className="p-5 overflow-y-auto">
                                {!success ? (
                                    <div className="space-y-4">
                                        {/* Error Alert */}
                                        {error && (
                                            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                                                <MdWarning className="text-lg shrink-0" />
                                                {error}
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori</label>
                                            <div className="relative">
                                                <select
                                                    value={category}
                                                    onChange={(e) => setCategory(e.target.value)}
                                                    className="w-full appearance-none rounded-xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 px-4 py-3 pr-10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
                                                >
                                                    <option disabled value="">Pilih Kategori</option>
                                                    <option value="technical">Masalah Teknis</option>
                                                    <option value="billing">Tagihan & Pembayaran</option>
                                                    <option value="account">Akun Saya</option>
                                                    <option value="other">Lainnya</option>
                                                </select>
                                                <MdExpandMore className="pointer-events-none absolute right-3 top-3.5 text-2xl text-gray-500" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul</label>
                                            <input
                                                type="text"
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                                placeholder="Contoh: Internet Mati Total"
                                                className="w-full rounded-xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
                                            <textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                className="w-full rounded-xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0d9488] resize-none"
                                                placeholder="Jelaskan masalah Anda secara detail..."
                                                rows={4}
                                            ></textarea>
                                        </div>

                                        <button
                                            onClick={handleSubmit}
                                            disabled={submitting}
                                            className="w-full py-3.5 bg-[#0d9488] hover:bg-teal-600 text-white rounded-xl font-bold shadow-lg shadow-teal-900/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            {submitting ? 'Mengirim...' : 'Kirim Tiket'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center py-6">
                                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                                            <MdCheckCircle className="text-4xl text-green-500" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Tiket Terkirim!</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                            Nomor Tiket: <span className="font-mono font-bold text-slate-900 dark:text-white">{ticketNumber}</span>
                                            <br />Tim kami akan segera memproses laporan Anda.
                                        </p>
                                        <button
                                            onClick={() => {
                                                setSuccess(false)
                                                setShowCreateModal(false)
                                            }}
                                            className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-900 dark:text-white rounded-xl font-bold transition-all"
                                        >
                                            Tutup
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
