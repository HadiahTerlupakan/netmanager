'use client'

import React from 'react'
import type { RABProject, LinearGrowthSettings, PercentageGrowthSettings } from './RABList'
import { calculateRealisticBEP } from './RABList'
import { Modal, ModalFooter } from '@/components/ui/Modal'

interface RABCompareProps {
    projects: RABProject[]
    isOpen: boolean
    onClose: () => void
}

export default function RABCompare({ projects, isOpen, onClose }: RABCompareProps) {
    const formatCurrency = (amount: number | bigint) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Number(amount))
    }

    if (!projects || projects.length === 0) return null

    // Helper to get total CAPEX
    const getCapex = (project: RABProject) => {
        return project.items
            .filter(item => !item.expenseType || item.expenseType === 'CAPEX')
            .reduce((sum, item) => sum + Number(item.totalPrice), 0)
    }

    // Helper to get growth model desc
    const getGrowthModelDesc = (project: RABProject) => {
        if (project.growthType === 'LINEAR') {
            const s = project.growthSettings as LinearGrowthSettings
            return `Linear (${s?.subscribersPerMonth || 0}/Bln)`
        } else if (project.growthType === 'PERCENTAGE') {
            const s = project.growthSettings as PercentageGrowthSettings
            return `Persentase (Naik ${s?.monthlyGrowthPercent || 0}%/Bln)`
        }
        return 'Kustom'
    }

    // Helper to get recovery setting
    const getRecoveryDesc = (project: RABProject) => {
        if (project.investmentRecoveryType === 'PERCENTAGE') {
            return `${project.investmentRecoveryValue}% dari Profit Kotor`
        }
        return `${formatCurrency(project.investmentRecoveryValue || 0)} / Bulan`
    }

    // Calculate BEP specific data for all projects once
    const bepData = projects.map(p => {
        const result = calculateRealisticBEP(p)
        return { bepMonth: result.bepMonth, monthsToFullCapacity: result.monthsToFullCapacity }
    })

    // Calculate Final Return Summary for each project based on its max duration
    const getFinalSummary = (project: RABProject) => {
        const arpuVal = Number(project.arpu || 0)
        const totalOpex = Number(project.projectedOpex || 0)
        const totalCapex = getCapex(project)
        const maxMonths = project.investmentDurationMonths || 12
        const recoveryType = project.investmentRecoveryType || 'PERCENTAGE'
        const recoveryValue = project.investmentRecoveryValue || 50
        const investorSharePercent = project.investorProfitSharePercent || 50

        let accumulatedInvestor = 0
        let accumulatedCompany = 0
        let currentBalance = totalCapex
        let previousSubs = 0

        // Use standard growth calculator (or simplified iteration)
        for (let i = 0; i < maxMonths; i++) {
            let subs = 0
            if (project.growthType === 'LINEAR') {
                const s = project.growthSettings as LinearGrowthSettings
                subs = Math.min(project.targetSubscribers || 0, previousSubs + (s?.subscribersPerMonth || 0))
            } else if (project.growthType === 'PERCENTAGE') {
                const s = project.growthSettings as PercentageGrowthSettings
                if (i === 0) subs = Math.min(project.targetSubscribers || 0, (s?.initialPercent || 0) * (project.targetSubscribers || 0) / 100)
                else subs = Math.min(project.targetSubscribers || 0, previousSubs + (previousSubs * (s?.monthlyGrowthPercent || 0) / 100))
            } else {
                subs = project.targetSubscribers || 0 // Fallback for simple display, exact logic relies on calculateMonthlySubscribers
            }

            const billingSubs = project.paymentType === 'POSTPAID' ? previousSubs : subs
            const grossProfit = (billingSubs * arpuVal) - totalOpex

            let recoveryInstallment = 0
            if (currentBalance > 0 && grossProfit > 0) {
                if (recoveryType === 'PERCENTAGE') {
                    recoveryInstallment = (recoveryValue / 100) * grossProfit
                } else {
                    recoveryInstallment = recoveryValue
                }
                recoveryInstallment = Math.min(recoveryInstallment, currentBalance, grossProfit)
            }

            currentBalance -= recoveryInstallment
            const netProfit = Math.max(0, grossProfit - recoveryInstallment)
            const investorShare = (investorSharePercent / 100) * netProfit
            const companyShare = netProfit - investorShare

            accumulatedInvestor += investorShare + recoveryInstallment
            accumulatedCompany += companyShare

            previousSubs = subs
        }

        return {
            totalInvestor: accumulatedInvestor,
            totalCompany: accumulatedCompany
        }
    }

    const finalSummaries = projects.map(p => getFinalSummary(p))

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Komparasi RAB (${projects.length} Proyek)`}
            size="4xl"
            padding={false}
        >
            <div className="w-full overflow-x-auto min-h-[50vh]">
                <table className="w-full text-sm text-left align-top min-w-[800px]">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                        <tr>
                            <th scope="col" className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-48 shrink-0">
                                Parameter
                            </th>
                            {projects.map((p, i) => (
                                <th key={p.id} scope="col" className="px-4 py-3 font-semibold text-gray-900 dark:text-white border-l border-gray-200 dark:border-gray-700 w-72">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-normal text-indigo-600 dark:text-indigo-400 mb-0.5">Proyek #{i + 1}</span>
                                        <span className="truncate">{p.name}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">

                        {/* --- INFORMASI UMUM --- */}
                        <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                            <td colSpan={projects.length + 1} className="px-4 py-2 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Informasi Umum
                            </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Status</td>
                            {projects.map(p => (
                                <td key={p.id} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${p.status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                        p.status === 'REJECTED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                        }`}>
                                        {p.status}
                                    </span>
                                </td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Site / Area</td>
                            {projects.map(p => (
                                <td key={p.id} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                    {p.site?.name || p.mixRadiusGroup?.name || '-'}
                                </td>
                            ))}
                        </tr>

                        {/* --- ASUMSI BISNIS --- */}
                        <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                            <td colSpan={projects.length + 1} className="px-4 py-2 mt-4 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Asumsi Bisnis & Tagihan
                            </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Target Pelanggan Akhir</td>
                            {projects.map(p => (
                                <td key={p.id} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-300 font-semibold">
                                    {p.targetSubscribers || 0}
                                </td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">ARPU (Rata-rata Tagihan)</td>
                            {projects.map(p => (
                                <td key={p.id} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-300 font-semibold text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(Number(p.arpu || 0))}
                                </td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Model Pertumbuhan</td>
                            {projects.map(p => (
                                <td key={p.id} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                    {getGrowthModelDesc(p)}
                                </td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Sistem Pembayaran</td>
                            {projects.map(p => (
                                <td key={p.id} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                    {p.paymentType === 'POSTPAID' ? 'Pascabayar' : 'Prabayar'}
                                </td>
                            ))}
                        </tr>

                        {/* --- BIAYA (CAPEX & OPEX) --- */}
                        <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                            <td colSpan={projects.length + 1} className="px-4 py-2 mt-4 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Struktur Biaya
                            </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750 bg-orange-50/30 dark:bg-orange-900/10">
                            <td className="px-4 py-3 text-orange-700 dark:text-orange-400 font-medium">Modal Awal (CAPEX)</td>
                            {projects.map(p => (
                                <td key={p.id} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-orange-700 dark:text-orange-400 font-bold">
                                    {formatCurrency(getCapex(p))}
                                </td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Operasional per Bulan (OPEX)</td>
                            {projects.map(p => (
                                <td key={p.id} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                    {formatCurrency(Number(p.projectedOpex || 0))}
                                </td>
                            ))}
                        </tr>

                        {/* --- INVESTASI & BAGI HASIL --- */}
                        <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                            <td colSpan={projects.length + 1} className="px-4 py-2 mt-4 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Investasi & Bagi Hasil
                            </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Durasi Kontrak</td>
                            {projects.map(p => (
                                <td key={p.id} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                    {p.investmentDurationMonths || 12} Bulan
                                </td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Angsuran Recovery Modal</td>
                            {projects.map(p => (
                                <td key={p.id} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                    {getRecoveryDesc(p)}
                                </td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Porsi Profit Investor : Perusahaan</td>
                            {projects.map(p => (
                                <td key={p.id} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{p.investorProfitSharePercent}%</span>
                                        <span className="text-gray-400">:</span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{100 - (p.investorProfitSharePercent || 50)}%</span>
                                    </div>
                                </td>
                            ))}
                        </tr>

                        {/* --- RINGKASAN BEP & ROI --- */}
                        <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                            <td colSpan={projects.length + 1} className="px-4 py-2 mt-4 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Prediksi BEP & ROI (Otomatis)
                            </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Kapasitas Penuh di Bulan Ke-</td>
                            {bepData.map((b, i) => (
                                <td key={`fp-${i}`} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium">
                                        Bulan {b.monthsToFullCapacity}
                                    </span>
                                </td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">BEP Total (Selesai Angsuran)</td>
                            {bepData.map((b, i) => (
                                <td key={`bep-${i}`} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                    {b.bepMonth === Infinity ? (
                                        <span className="text-red-500 font-medium">Tidak Tercapai / Rugi</span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                                            Bulan {b.bepMonth}
                                        </span>
                                    )}
                                </td>
                            ))}
                        </tr>

                        {/* --- RINGKASAN PEMBAGIAN AKHIR --- */}
                        <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                            <td colSpan={projects.length + 1} className="px-4 py-2 mt-4 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Ringkasan Pembagian Akhir (Hingga Kontrak Berakhir)
                            </td>
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Total Diterima Investor (Modal + Profit)</td>
                            {projects.map((p, i) => (
                                <td key={`total-inv-${p.id}`} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-indigo-700 dark:text-indigo-400 font-bold">
                                    {formatCurrency(finalSummaries[i].totalInvestor)}
                                </td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Total Diterima Perusahaan (Profit Bersih)</td>
                            {projects.map((p, i) => (
                                <td key={`total-comp-${p.id}`} className="px-4 py-3 border-l border-gray-100 dark:border-gray-700 text-emerald-700 dark:text-emerald-400 font-bold">
                                    {formatCurrency(finalSummaries[i].totalCompany)}
                                </td>
                            ))}
                        </tr>

                    </tbody>
                </table>
            </div>

            <ModalFooter>
                <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 sm:w-auto"
                    onClick={onClose}
                >
                    Tutup Komparasi
                </button>
            </ModalFooter>
        </Modal>
    )
}
