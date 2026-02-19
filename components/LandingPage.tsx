'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
    MdLogin,
    MdRocketLaunch,
    MdShield,
    MdSupportAgent,
    MdBolt,
    MdStar,
    MdExpandMore,
    MdLocationOn,
    MdCall,
    MdMail,
    MdPinDrop
} from 'react-icons/md'
import { Button } from '@/components/ui/Button'

export default function LandingPage() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "InternetServiceProvider",
        "name": "SBLNET.ID",
        "image": "https://sblnet.id/images/logo-sbl.png",
        "description": "Penyedia layanan internet fiber optik unlimited dengan koneksi stabil dan support 24/7.",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Jl. Prof. Dr. Soepomo No.73B, Menteng Dalam, Tebet",
            "addressLocality": "Jakarta Selatan",
            "addressRegion": "DKI Jakarta",
            "postalCode": "12870",
            "addressCountry": "ID"
        },
        "telephone": "021-83705900",
        "priceRange": "$$",
        "openingHoursSpecification": {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday"
            ],
            "opens": "00:00",
            "closes": "23:59"
        },
        "url": "https://sblnet.id"
    }

    return (
        <div className="bg-slate-50 dark:bg-[#101922] text-slate-900 dark:text-white font-sans antialiased overflow-x-hidden min-h-screen">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <style jsx global>{`
                .curved-bottom {
                    border-bottom-left-radius: 2.5rem;
                    border-bottom-right-radius: 2.5rem;
                }
            `}</style>

            <main className="relative flex h-full w-full max-w-md mx-auto flex-col min-h-screen bg-white dark:bg-[#101922] shadow-2xl overflow-hidden">

                {/* Hero Section */}
                <header className="relative bg-linear-to-b from-teal-50 to-white text-slate-900 pb-20 pt-8 px-6 curved-bottom overflow-hidden shadow-sm z-10 border-b border-slate-100">
                    {/* CSS gradient background instead of external image for better performance */}
                    <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-teal-200 via-transparent to-transparent"></div>
                    <div className="absolute inset-0 bg-linear-to-b from-white/60 to-white/95 z-0"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2">
                                <div>
                                    <Image
                                        src="/images/logo-sbl.png"
                                        alt="PT. Surya Bestari Lestari"
                                        width={152}
                                        height={48}
                                        className="h-12 w-auto object-contain"
                                        priority
                                    />
                                </div>
                            </div>
                            <Link href="/dukungan" className="text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-full transition-colors border border-slate-200 shadow-sm">
                                Bantuan
                            </Link>
                        </div>
                        <div className="mb-8">
                            <div className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-600 text-[10px] font-bold px-3 py-1 rounded-full border border-teal-100 mb-5 uppercase tracking-wider backdrop-blur-sm shadow-sm">
                                <MdBolt className="text-[14px]" />
                                New Speed Available
                            </div>
                            <h1 className="text-[38px] font-extrabold leading-[1.1] mb-4 tracking-tight drop-shadow-sm text-slate-900">
                                Internet <span className="text-orange-500">Ngebut</span>,<br />
                                Tanpa Ribet.
                            </h1>
                            <p className="text-slate-500 text-[15px] leading-relaxed max-w-[90%] font-medium">
                                Rasakan pengalaman browsing, gaming, dan streaming tanpa batas dengan jaringan fiber optik #1.
                            </p>
                        </div>
                        <div className="flex items-center gap-5 mb-4">
                            <div className="flex items-baseline text-slate-900">
                                <span className="text-6xl font-black tracking-tighter">1</span>
                                <span className="text-xl font-bold text-slate-400 ml-1">Gbps</span>
                            </div>
                            <div className="h-10 w-px bg-slate-200"></div>
                            <div>
                                <div className="flex text-orange-400 text-sm mb-1 gap-0.5">
                                    <MdStar className="text-[18px]" />
                                    <MdStar className="text-[18px]" />
                                    <MdStar className="text-[18px]" />
                                    <MdStar className="text-[18px]" />
                                    <MdStar className="text-[18px]" />
                                </div>
                                <p className="text-xs text-slate-400 font-medium">4.9/5 dari Pengguna</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Login/Register Buttons */}
                <div className="px-6 -mt-10 relative z-20 mb-10">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-blue-900/10 dark:shadow-black/30 p-2.5 flex flex-col sm:flex-row gap-2.5 border border-slate-100 dark:border-slate-700">
                        <Link href="/login" className="w-full">
                            <Button className="w-full group">
                                <span>Masuk ke Portal</span>
                                <MdLogin className="text-sm group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                        <Link href="/register" className="w-full">
                            <Button variant="outline" className="w-full">
                                Daftar Baru
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Features */}
                <section className="px-6 pb-2">
                    <h2 className="font-bold text-slate-900 dark:text-white text-lg mb-2 flex items-center gap-2">
                        <span className="w-1 h-6 bg-[#0f62fe] rounded-full"></span>
                        Tentang SBLNET.ID
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                        Kami adalah penyedia layanan internet fiber optik terdepan yang berkomitmen menghadirkan koneksi stabil untuk mendukung produktivitas digital keluarga Indonesia.
                    </p>
                    <div className="grid grid-cols-1 gap-4 mb-8">
                        <div className="group flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                            <div className="size-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0f62fe] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                                <MdRocketLaunch className="text-[28px]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-1.5 text-[15px]">Koneksi Hyper-Speed</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Download file besar dalam hitungan detik dengan bandwidth stabil tanpa FUP.</p>
                            </div>
                        </div>
                        <div className="group flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                            <div className="size-12 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                                <MdShield className="text-[28px]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-1.5 text-[15px]">Anti Badai & Gangguan</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Infrastruktur kabel tanam bawah tanah yang tahan segala kondisi cuaca ekstrem.</p>
                            </div>
                        </div>
                        <div className="group flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                            <div className="size-12 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                                <MdSupportAgent className="text-[28px]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-1.5 text-[15px]">Layanan CS 24/7</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Tim teknis dan customer service kami siap membantu Anda kapanpun dibutuhkan.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="px-6 pb-10">
                    <h2 className="font-bold text-slate-900 dark:text-white text-lg mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-[#3ddbd9] rounded-full"></span>
                        Pertanyaan Umum (FAQ)
                    </h2>
                    <div className="space-y-3">
                        <details className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 open:shadow-md transition-all duration-300">
                            <summary className="flex justify-between items-center font-medium cursor-pointer list-none p-5">
                                <span className="text-slate-900 dark:text-white text-[15px] font-bold">Berapa lama proses pemasangan?</span>
                                <span className="transition group-open:rotate-180">
                                    <MdExpandMore className="text-slate-400 text-2xl" />
                                </span>
                            </summary>
                            <div className="text-slate-500 dark:text-slate-400 text-sm px-5 pb-5 leading-relaxed">
                                Standar waktu pemasangan kami adalah maksimal 3x24 jam setelah registrasi dan verifikasi data berhasil dilakukan.
                            </div>
                        </details>
                        <details className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 open:shadow-md transition-all duration-300">
                            <summary className="flex justify-between items-center font-medium cursor-pointer list-none p-5">
                                <span className="text-slate-900 dark:text-white text-[15px] font-bold">Apakah ada biaya tersembunyi?</span>
                                <span className="transition group-open:rotate-180">
                                    <MdExpandMore className="text-slate-400 text-2xl" />
                                </span>
                            </summary>
                            <div className="text-slate-500 dark:text-slate-400 text-sm px-5 pb-5 leading-relaxed">
                                Tidak ada. Tagihan bulanan Anda akan tetap (flat) sesuai dengan paket yang dipilih selama masa berlangganan aktif.
                            </div>
                        </details>
                        <details className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 open:shadow-md transition-all duration-300">
                            <summary className="flex justify-between items-center font-medium cursor-pointer list-none p-5">
                                <span className="text-slate-900 dark:text-white text-[15px] font-bold">Metode pembayaran yang tersedia?</span>
                                <span className="transition group-open:rotate-180">
                                    <MdExpandMore className="text-slate-400 text-2xl" />
                                </span>
                            </summary>
                            <div className="text-slate-500 dark:text-slate-400 text-sm px-5 pb-5 leading-relaxed">
                                Kami menerima pembayaran melalui Transfer Bank, Kartu Kredit, E-Wallet (GoPay, OVO, Dana), dan gerai minimarket.
                            </div>
                        </details>
                    </div>
                </section>

                {/* Contact Us */}
                <section className="px-6 pb-6">
                    <div className="bg-linear-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 relative overflow-hidden shadow-lg">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
                        <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-[#0f62fe]/20 rounded-full blur-xl"></div>
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                <MdPinDrop className="text-[#3ddbd9]" />
                                Hubungi Kami
                            </h3>
                            <ul className="space-y-5">
                                <li className="flex items-start gap-4">
                                    <div className="size-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                                        <MdLocationOn className="text-lg" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-white">Kantor Pusat</p>
                                        <p className="text-xs text-slate-300 mt-1 leading-relaxed opacity-80">Caprof Building Jl. Prof. Dr. Soepomo No.73B, Menteng Dalam, Tebet, Jakarta Selatan</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-4">
                                    <div className="size-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                                        <MdCall className="text-lg" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-white">Call Center</p>
                                        <p className="text-xs text-slate-300 mt-1 opacity-80">021-83705900 (24 Jam)</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-4">
                                    <div className="size-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                                        <MdMail className="text-lg" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-white">Email Support</p>
                                        <p className="text-xs text-slate-300 mt-1 opacity-80">care@sblnet.id</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 mt-auto">
                    <p className="text-xs text-slate-400 mb-3 font-medium">Butuh bantuan sebelum mendaftar?</p>
                    <a className="inline-flex items-center gap-2 text-[#0f62fe] font-bold text-sm hover:underline decoration-2 underline-offset-2" href="#">
                        <MdSupportAgent className="text-[20px]" />
                        Hubungi Sales Kami
                    </a>
                    <div className="mt-8 text-[11px] text-slate-400 leading-relaxed">
                        © 2023 SBLNET.ID. All rights reserved.<br />
                        <span className="opacity-70">Terdaftar dan diawasi oleh Kominfo.</span>
                    </div>
                </footer>
            </main>
        </div>
    )
}
