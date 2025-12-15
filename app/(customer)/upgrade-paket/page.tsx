'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCustomerAuth } from '@/components/customer/CustomerAuthProvider'
import {
    MdArrowBack,
    MdCalendarMonth,
    MdSpeed,
    MdRocketLaunch,
    MdSportsEsports,
    MdCheckCircle,
    MdArrowForward,
    MdInfo
} from 'react-icons/md'

export default function CustomerUpgradePackagePage() {
    const { isLoading: authLoading, isAuthenticated } = useCustomerAuth()
    const router = useRouter()
    const [selectedPlan, setSelectedPlan] = useState('100 Mbps Family')
    const [billingPeriod, setBillingPeriod] = useState('Bulanan')

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
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>

            <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden pb-32 max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922]">

                {/* Top App Bar */}
                <div className="sticky top-0 z-50 flex items-center bg-white/90 dark:bg-[#101922]/90 backdrop-blur-md p-4 border-b border-gray-200 dark:border-gray-800 justify-between">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-900 dark:text-white"
                    >
                        <MdArrowBack className="text-2xl" />
                    </button>
                    <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">Upgrade Paket</h2>
                </div>

                {/* Current Plan Section */}
                <div className="p-4 pt-6">
                    <div className="flex items-stretch justify-between gap-4 rounded-xl bg-white dark:bg-[#1c2732] p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex flex-col justify-center gap-1 flex-[2_2_0px]">
                            <p className="text-[#617589] dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Paket Saat Ini</p>
                            <p className="text-[#111418] dark:text-white text-lg font-bold leading-tight">20 Mbps Home Basic</p>
                            <div className="flex items-center gap-1 mt-1 text-[#0d9488]">
                                <MdCalendarMonth className="text-sm" />
                                <p className="text-sm font-medium leading-normal">Aktif sampai 20 Nov 2023</p>
                            </div>
                        </div>
                        <div
                            className="w-24 bg-center bg-no-repeat bg-cover rounded-lg shrink-0 shadow-inner"
                            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBMEALnVJw-DxXEKLks_QeIdiSxPUJ3jKKjNV1pbmcDZNM5VKfzWBcZCR6ALx5LLz9wINYHdRddWJ-6z5DjqI43LW_BbXuDWE_OqTZsJ5k6SF6hMnwdNcIor60C1aEAk7xH9YaI1A-sxgAKxAZGNt4_o_6qaZy-SAQduB1l3DlNID2r8rOkwmt9L35bAsB-OE5eyvSIekWUwtgRSBPuNBaZ0urwPCS8yUOIYWrf4X5XOYI-gcutcDNVY3DoXEha_4ssIyyPLVcQjKM")' }}
                        >
                        </div>
                    </div>
                </div>

                {/* Segmented Control */}
                <div className="px-4 py-2">
                    <h3 className="text-[#111418] dark:text-white tracking-tight text-xl font-bold leading-tight pb-4">Pilihan Upgrade</h3>
                    <div className="flex h-12 w-full items-center justify-center rounded-xl bg-gray-200 dark:bg-gray-800 p-1">
                        <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 ${billingPeriod === 'Bulanan' ? 'bg-white dark:bg-[#1c2732] shadow-sm text-[#0d9488]' : 'text-gray-500 dark:text-gray-400'} text-sm font-bold transition-all`}>
                            <span className="truncate">Bulanan</span>
                            <input
                                className="invisible w-0 absolute"
                                name="billing-period"
                                type="radio"
                                value="Bulanan"
                                checked={billingPeriod === 'Bulanan'}
                                onChange={() => setBillingPeriod('Bulanan')}
                            />
                        </label>
                        <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 ${billingPeriod === 'Tahunan' ? 'bg-white dark:bg-[#1c2732] shadow-sm text-[#0d9488]' : 'text-gray-500 dark:text-gray-400'} text-sm font-bold transition-all`}>
                            <span className="truncate">Tahunan (Hemat 15%)</span>
                            <input
                                className="invisible w-0 absolute"
                                name="billing-period"
                                type="radio"
                                value="Tahunan"
                                checked={billingPeriod === 'Tahunan'}
                                onChange={() => setBillingPeriod('Tahunan')}
                            />
                        </label>
                    </div>
                </div>

                {/* Pricing Cards List */}
                <div className="flex flex-col gap-4 px-4 py-3">
                    {/* Option 1 */}
                    <label className={`group relative flex flex-col gap-4 rounded-xl border border-solid ${selectedPlan === '50 Mbps Streamer' ? 'border-[#0d9488] ring-1 ring-[#0d9488] bg-teal-50/30 dark:bg-teal-900/10' : 'border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-[#1c2732]'} p-5 cursor-pointer transition-all hover:border-[#0d9488]/50`}>
                        <div className="absolute top-5 right-5">
                            <input
                                className="peer h-6 w-6 border-gray-300 text-[#0d9488] focus:ring-[#0d9488]"
                                name="plan_selection"
                                type="radio"
                                checked={selectedPlan === '50 Mbps Streamer'}
                                onChange={() => setSelectedPlan('50 Mbps Streamer')}
                            />
                        </div>
                        <div className="flex flex-col gap-1 pr-8">
                            <div className="flex items-center gap-2">
                                <MdSpeed className="text-[#0d9488] text-[28px]" />
                                <h1 className="text-[#111418] dark:text-white text-lg font-bold leading-tight">50 Mbps Streamer</h1>
                            </div>
                            <p className="flex items-baseline gap-1 text-[#111418] dark:text-white mt-2">
                                <span className="text-2xl font-black leading-tight tracking-[-0.033em]">Rp 350rb</span>
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">/bulan</span>
                            </p>
                        </div>
                        <div className="w-full h-px bg-gray-100 dark:bg-gray-700"></div>
                        <div className="flex flex-col gap-2">
                            <div className="text-sm font-normal leading-normal flex gap-3 text-gray-700 dark:text-gray-300">
                                <MdCheckCircle className="text-green-600 dark:text-green-400 text-[20px]" />
                                Ideal untuk Streaming HD
                            </div>
                            <div className="text-sm font-normal leading-normal flex gap-3 text-gray-700 dark:text-gray-300">
                                <MdCheckCircle className="text-green-600 dark:text-green-400 text-[20px]" />
                                Unlimited Kuota
                            </div>
                            <div className="text-sm font-normal leading-normal flex gap-3 text-gray-700 dark:text-gray-300">
                                <MdCheckCircle className="text-green-600 dark:text-green-400 text-[20px]" />
                                Gratis Router Basic
                            </div>
                        </div>
                    </label>

                    {/* Option 2 (Recommended) */}
                    <label className={`group relative flex flex-col gap-4 rounded-xl border-2 border-solid ${selectedPlan === '100 Mbps Family' ? 'border-[#0d9488] bg-teal-50/30 dark:bg-teal-900/10' : 'border-[#0d9488] bg-white dark:bg-[#1c2732]'} p-5 cursor-pointer shadow-lg shadow-teal-100 dark:shadow-none transition-all`}>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0d9488] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-sm">
                            Paling Laris
                        </div>
                        <div className="absolute top-5 right-5">
                            <input
                                className="peer h-6 w-6 border-gray-300 text-[#0d9488] focus:ring-[#0d9488]"
                                name="plan_selection"
                                type="radio"
                                checked={selectedPlan === '100 Mbps Family'}
                                onChange={() => setSelectedPlan('100 Mbps Family')}
                            />
                        </div>
                        <div className="flex flex-col gap-1 pr-8">
                            <div className="flex items-center gap-2">
                                <MdRocketLaunch className="text-[#0d9488] text-[28px]" />
                                <h1 className="text-[#111418] dark:text-white text-lg font-bold leading-tight">100 Mbps Family</h1>
                            </div>
                            <p className="flex items-baseline gap-1 text-[#111418] dark:text-white mt-2">
                                <span className="text-2xl font-black leading-tight tracking-[-0.033em]">Rp 550rb</span>
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">/bulan</span>
                            </p>
                        </div>
                        <div className="w-full h-px bg-gray-100 dark:bg-gray-700"></div>
                        <div className="flex flex-col gap-2">
                            <div className="text-sm font-bold leading-normal flex gap-3 text-[#111418] dark:text-white">
                                <MdCheckCircle className="text-[#0d9488] text-[20px]" />
                                <span className="text-[#0d9488]">Best Value</span>
                            </div>
                            <div className="text-sm font-normal leading-normal flex gap-3 text-gray-700 dark:text-gray-300">
                                <MdCheckCircle className="text-green-600 dark:text-green-400 text-[20px]" />
                                Termasuk 50+ Channel TV
                            </div>
                            <div className="text-sm font-normal leading-normal flex gap-3 text-gray-700 dark:text-gray-300">
                                <MdCheckCircle className="text-green-600 dark:text-green-400 text-[20px]" />
                                Gratis Disney+ Hotstar
                            </div>
                            <div className="text-sm font-normal leading-normal flex gap-3 text-gray-700 dark:text-gray-300">
                                <MdCheckCircle className="text-green-600 dark:text-green-400 text-[20px]" />
                                Prioritas Support
                            </div>
                        </div>
                    </label>

                    {/* Option 3 */}
                    <label className={`group relative flex flex-col gap-4 rounded-xl border border-solid ${selectedPlan === '1 Gbps Pro Gamer' ? 'border-[#0d9488] ring-1 ring-[#0d9488] bg-teal-50/30 dark:bg-teal-900/10' : 'border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-[#1c2732]'} p-5 cursor-pointer transition-all hover:border-[#0d9488]/50`}>
                        <div className="absolute top-5 right-5">
                            <input
                                className="peer h-6 w-6 border-gray-300 text-[#0d9488] focus:ring-[#0d9488]"
                                name="plan_selection"
                                type="radio"
                                checked={selectedPlan === '1 Gbps Pro Gamer'}
                                onChange={() => setSelectedPlan('1 Gbps Pro Gamer')}
                            />
                        </div>
                        <div className="flex flex-col gap-1 pr-8">
                            <div className="flex items-center gap-2">
                                <MdSportsEsports className="text-[#0d9488] text-[28px]" />
                                <h1 className="text-[#111418] dark:text-white text-lg font-bold leading-tight">1 Gbps Pro Gamer</h1>
                            </div>
                            <p className="flex items-baseline gap-1 text-[#111418] dark:text-white mt-2">
                                <span className="text-2xl font-black leading-tight tracking-[-0.033em]">Rp 900rb</span>
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">/bulan</span>
                            </p>
                        </div>
                        <div className="w-full h-px bg-gray-100 dark:bg-gray-700"></div>
                        <div className="flex flex-col gap-2">
                            <div className="text-sm font-normal leading-normal flex gap-3 text-gray-700 dark:text-gray-300">
                                <MdCheckCircle className="text-green-600 dark:text-green-400 text-[20px]" />
                                Kecepatan Maksimal up to 1Gbps
                            </div>
                            <div className="text-sm font-normal leading-normal flex gap-3 text-gray-700 dark:text-gray-300">
                                <MdCheckCircle className="text-green-600 dark:text-green-400 text-[20px]" />
                                Static IP Public
                            </div>
                            <div className="text-sm font-normal leading-normal flex gap-3 text-gray-700 dark:text-gray-300">
                                <MdCheckCircle className="text-green-600 dark:text-green-400 text-[20px]" />
                                VIP Support 24/7
                            </div>
                        </div>
                    </label>
                </div>

                {/* Sticky Bottom Bar */}
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#1c2732] border-t border-gray-200 dark:border-gray-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] text-center max-w-md mx-auto">
                    <div className="flex flex-col gap-3 mx-auto max-w-2xl">
                        <div className="flex justify-between items-end">
                            <div className="flex flex-col items-start">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Paket Dipilih:</span>
                                <span className="font-bold text-[#111418] dark:text-white text-left">{selectedPlan}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs text-gray-500 dark:text-gray-400 line-through">Rp 650rb</span>
                                <span className="font-black text-lg text-[#0d9488]">Rp 550rb<span className="text-xs text-gray-500 dark:text-gray-400 font-normal">/bln</span></span>
                            </div>
                        </div>
                        <button className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-4 bg-[#0d9488] hover:bg-teal-600 text-white text-base font-bold leading-normal tracking-[0.015em] transition-colors shadow-lg shadow-teal-500/30">
                            <span className="truncate">Lanjut Upgrade</span>
                            <MdArrowForward className="ml-2 text-sm" />
                        </button>
                        <div className="flex justify-center items-center gap-1 text-[10px] text-gray-400">
                            <MdInfo className="text-[12px]" />
                            <a href="#" className="underline hover:text-gray-600">Syarat & Ketentuan Berlaku</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
