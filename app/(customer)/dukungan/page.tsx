'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCustomerAuth } from '@/components/customer/CustomerAuthProvider'
import {
    MdArrowBack,
    MdAccountCircle,
    MdSearch,
    MdReceiptLong,
    MdExpandMore,
    MdRouter,
    MdSignalWifiOff,
    MdCall,
    MdMail,
    MdSend,
    MdChatBubble
} from 'react-icons/md'

export default function CustomerSupportPage() {
    const { isLoading: authLoading, isAuthenticated } = useCustomerAuth()
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
        }
    }, [authLoading, isAuthenticated, router])

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-10 h-10 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="bg-[#f6f7f8] dark:bg-[#101922] font-sans antialiased text-[#111418] dark:text-white min-h-screen">
            <style jsx global>{`
                details > summary {
                    list-style: none;
                }
                details > summary::-webkit-details-marker {
                    display: none;
                }
                details[open] summary ~ * {
                    animation: sweep .3s ease-in-out;
                }
                @keyframes sweep {
                    0%    {opacity: 0; transform: translateY(-10px)}
                    100%  {opacity: 1; transform: translateY(0)}
                }
            `}</style>

            <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-white dark:bg-[#101922] shadow-2xl">

                {/* TopAppBar */}
                <div className="sticky top-0 z-50 flex items-center bg-white dark:bg-[#1C2630] p-4 pb-2 justify-between border-b border-gray-100 dark:border-gray-800">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-900 dark:text-white"
                    >
                        <MdArrowBack className="text-2xl" />
                    </button>
                    <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Dukungan Pelanggan</h2>
                    <div className="flex w-12 items-center justify-end">
                        <Link href="/profil" className="flex size-12 cursor-pointer items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <MdAccountCircle className="text-[#111418] dark:text-white text-[28px]" />
                        </Link>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">

                    {/* Hero / Search Section */}
                    <div className="pt-6 px-4 pb-2">
                        <h2 className="text-[#111418] dark:text-white tracking-tight text-[28px] font-bold leading-tight text-left pb-4">Apa yang bisa kami bantu?</h2>
                        <label className="flex flex-col w-full">
                            <div className="flex w-full items-stretch rounded-xl h-12 bg-gray-100 dark:bg-gray-800 border border-transparent focus-within:border-[#0d9488] focus-within:ring-2 focus-within:ring-[#0d9488]/20 transition-all">
                                <div className="flex items-center justify-center pl-4 text-gray-500 dark:text-gray-400">
                                    <MdSearch className="text-2xl" />
                                </div>
                                <input
                                    className="flex w-full min-w-0 flex-1 bg-transparent border-none text-[#111418] dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-0 focus:outline-none px-3 text-base font-normal leading-normal h-full rounded-xl"
                                    placeholder="Cari masalah (mis. Wifi mati)"
                                />
                            </div>
                        </label>
                    </div>

                    {/* FAQ Section */}
                    <div className="mt-4">
                        <h3 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-2">Pertanyaan Populer</h3>
                        <div className="flex flex-col px-4 gap-3">

                            {/* Accordion Item 1 */}
                            <details className="group flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C2630] transition-all hover:border-[#0d9488]/50">
                                <summary className="flex cursor-pointer items-center justify-between p-4 list-none">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center size-8 rounded-full bg-[#0d9488]/10 text-[#0d9488]">
                                            <MdReceiptLong className="text-[18px]" />
                                        </div>
                                        <p className="text-[#111418] dark:text-white text-sm font-semibold leading-normal">Cara bayar tagihan</p>
                                    </div>
                                    <MdExpandMore className="text-gray-500 transition-transform group-open:rotate-180 text-[20px]" />
                                </summary>
                                <div className="px-4 pb-4 pl-[3.25rem]">
                                    <p className="text-gray-600 dark:text-gray-300 text-sm font-normal leading-relaxed">
                                        Anda dapat membayar tagihan melalui aplikasi ini di menu "Tagihan", melalui transfer bank, atau di minimarket terdekat.
                                    </p>
                                </div>
                            </details>

                            {/* Accordion Item 2 */}
                            <details className="group flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C2630] transition-all hover:border-[#0d9488]/50">
                                <summary className="flex cursor-pointer items-center justify-between p-4 list-none">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center size-8 rounded-full bg-[#0d9488]/10 text-[#0d9488]">
                                            <MdRouter className="text-[18px]" />
                                        </div>
                                        <p className="text-[#111418] dark:text-white text-sm font-semibold leading-normal">Reset modem</p>
                                    </div>
                                    <MdExpandMore className="text-gray-500 transition-transform group-open:rotate-180 text-[20px]" />
                                </summary>
                                <div className="px-4 pb-4 pl-[3.25rem]">
                                    <p className="text-gray-600 dark:text-gray-300 text-sm font-normal leading-relaxed">
                                        Tekan tombol reset kecil di belakang modem selama 10 detik hingga lampu berkedip, lalu tunggu 3-5 menit.
                                    </p>
                                </div>
                            </details>

                            {/* Accordion Item 3 */}
                            <details className="group flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C2630] transition-all hover:border-[#0d9488]/50">
                                <summary className="flex cursor-pointer items-center justify-between p-4 list-none">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center size-8 rounded-full bg-[#0d9488]/10 text-[#0d9488]">
                                            <MdSignalWifiOff className="text-[18px]" />
                                        </div>
                                        <p className="text-[#111418] dark:text-white text-sm font-semibold leading-normal">Cek status gangguan</p>
                                    </div>
                                    <MdExpandMore className="text-gray-500 transition-transform group-open:rotate-180 text-[20px]" />
                                </summary>
                                <div className="px-4 pb-4 pl-[3.25rem]">
                                    <p className="text-gray-600 dark:text-gray-300 text-sm font-normal leading-relaxed">
                                        Tidak ada gangguan masal yang terdeteksi di area Anda saat ini.
                                    </p>
                                </div>
                            </details>
                        </div>
                    </div>

                    {/* Contact Actions Grid */}
                    <div className="mt-8 px-4">
                        <h3 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] pb-3">Hubungi Kami</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Call Card */}
                            <a className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group" href="tel:08001234567">
                                <div className="mb-2 p-3 bg-white dark:bg-gray-700 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                    <MdCall className="text-[#0d9488] text-[28px]" />
                                </div>
                                <span className="text-sm font-semibold text-[#111418] dark:text-white">Telepon</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">0800-123-4567</span>
                            </a>
                            {/* Email Card */}
                            <a className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group" href="mailto:support@provider.id">
                                <div className="mb-2 p-3 bg-white dark:bg-gray-700 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                    <MdMail className="text-[#0d9488] text-[28px]" />
                                </div>
                                <span className="text-sm font-semibold text-[#111418] dark:text-white">Email</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">support@provider.id</span>
                            </a>
                        </div>
                    </div>

                    {/* Message Form */}
                    <div className="mt-8 mb-10 px-4">
                        <h3 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] pb-3">Kirim Pesan</h3>
                        <div className="flex flex-col gap-4">
                            {/* Select Topic */}
                            <div className="relative">
                                <select
                                    defaultValue=""
                                    className="w-full appearance-none rounded-xl bg-gray-100 dark:bg-gray-800 border-none px-4 py-3 pr-10 text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0d9488]/50 text-base"
                                >
                                    <option disabled value="">Pilih Topik</option>
                                    <option value="technical">Masalah Teknis</option>
                                    <option value="billing">Tagihan & Pembayaran</option>
                                    <option value="account">Akun Saya</option>
                                    <option value="other">Lainnya</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                                    <MdExpandMore className="text-2xl" />
                                </div>
                            </div>
                            {/* Textarea */}
                            <textarea
                                className="w-full rounded-xl bg-gray-100 dark:bg-gray-800 border-none px-4 py-3 text-[#111418] dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d9488]/50 text-base resize-none"
                                placeholder="Deskripsi masalah Anda..."
                                rows={4}
                            ></textarea>
                            {/* Submit Button */}
                            <button className="flex w-full items-center justify-center rounded-xl bg-[#0d9488] py-3 text-base font-bold text-white shadow-lg shadow-[#0d9488]/30 hover:bg-teal-600 active:scale-[0.98] transition-all">
                                <MdSend className="mr-2 text-[20px]" />
                                Kirim Laporan
                            </button>
                        </div>
                    </div>
                    <div className="h-10"></div>
                </div>

                {/* Floating Chat Button */}
                <button className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-[#0d9488] text-white shadow-xl shadow-[#0d9488]/40 hover:bg-teal-600 active:scale-90 transition-transform">
                    <MdChatBubble className="text-[28px]" />
                </button>
            </div>
        </div>
    )
}
