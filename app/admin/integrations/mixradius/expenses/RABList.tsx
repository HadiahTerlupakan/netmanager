/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    HiOutlinePencilSquare,
    HiOutlineTrash,
    HiOutlineCalculator,
    HiOutlineBuildingOffice,
    HiOutlineArrowTrendingUp,
    HiOutlineUsers,
    HiOutlineEye,
    HiOutlineDocumentArrowDown,
    HiOutlineDocumentText,
    HiOutlineDocumentDuplicate
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import { formatCurrency } from '@/lib/utils'
import { usePermission } from '@/hooks/use-permission'
import RABCompare from './RABCompare'

interface RABItem {
    id: string
    name: string
    category?: string
    expenseCategory?: { name: string, parent?: { name: string } }
    quantity: number
    unitPrice: number
    totalPrice: number
    expenseType?: 'CAPEX' | 'OPEX'
    wbsGroupId?: string
    disbursements?: RABDisbursement[]
}

export interface RABWbs {
    id: string
    name: string
    order: number
}

export interface RABDisbursement {
    id: string
    name: string
    percentage: number
    amount: number
    estimatedDate?: string
    isPaid: boolean
}

export interface LinearGrowthSettings {
    subscribersPerMonth: number
}

export interface PercentageGrowthSettings {
    initialPercent: number
    monthlyGrowthPercent: number
}

export interface CustomMilestone {
    month: number
    percent: number
}

export interface CustomGrowthSettings {
    milestones: CustomMilestone[]
}

export type GrowthSettings = LinearGrowthSettings | PercentageGrowthSettings | CustomGrowthSettings

export interface RABActualAchievement {
    id: string
    month: number
    actualSubscribers: number
    actualRevenue: number
    manualRecoveryInstallment?: number | null
    manualInvestorShare?: number | null
    manualCompanyShare?: number | null
    manualInvestorProfitSharePercent?: number | null
    notes?: string
}

export interface RABApproval {
    id: string
    rabProjectId: string
    userId: string
    status: string
    createdAt: string
    user: {
        id: string
        name: string | null
        email: string
        role: {
            name: string
        } | null
    }
}

export interface RABProject {
    id: string
    name: string
    description?: string
    siteId?: string
    mixRadiusGroupId?: string
    site?: { name: string }
    mixRadiusGroup?: { name: string }
    projectedRevenue: number
    projectedOpex: number
    targetSubscribers?: number
    arpu?: number
    growthType?: 'LINEAR' | 'PERCENTAGE' | 'CUSTOM'
    paymentType?: 'PREPAID' | 'POSTPAID'
    growthSettings?: GrowthSettings
    actualAchievements?: RABActualAchievement[]
    startDate?: string
    investmentDurationMonths?: number
    investmentRecoveryType?: 'PERCENTAGE' | 'FIXED'
    investmentRecoveryValue?: number
    investorProfitSharePercent?: number
    contingencyPercent?: number
    contingencyAmount?: string | number
    nplTolerancePercent?: number
    hasDisbursementPlan?: boolean
    wbsGroups?: RABWbs[]
    disbursements?: RABDisbursement[]
    status: string
    items: RABItem[]
    approvals?: RABApproval[]
    createdAt: string
    updatedAt: string
}

interface RABListProps {
    onEdit: (project: RABProject) => void
    onView: (project: RABProject) => void
    refreshKey?: number
}

// Calculate realistic BEP considering growth period
export function calculateRealisticBEP(project: RABProject): { bepMonth: number; simpleBep: number; monthsToFullCapacity: number; roiPerYear: number } {
    const totalCapex = project.items
        .filter(item => !item.expenseType || item.expenseType === 'CAPEX')
        .reduce((sum, item) => sum + Number(item.totalPrice), 0)

    const monthlyOpex = Number(project.projectedOpex)
    const arpu = Number(project.arpu) || 0
    const targetSubscribers = project.targetSubscribers || 0
    const growthType = project.growthType || 'LINEAR'
    const paymentType = project.paymentType || 'PREPAID'
    const growthSettings = project.growthSettings

    const nplTolerancePercent = project.nplTolerancePercent || 0

    // Simple BEP (old calculation)
    const grossRevenue = Number(project.projectedRevenue)
    const fullRevenue = grossRevenue * (1 - (nplTolerancePercent / 100))
    const simpleProfit = fullRevenue - monthlyOpex

    let simpleBep = Infinity
    if (simpleProfit > 0) {
        if (paymentType === 'POSTPAID') {
            simpleBep = (totalCapex + fullRevenue) / simpleProfit
        } else {
            simpleBep = totalCapex / simpleProfit
        }
    }

    if (!targetSubscribers || !arpu || !growthSettings) {
        return { bepMonth: Infinity, simpleBep, monthsToFullCapacity: 0, roiPerYear: 0 }
    }

    // Realistic BEP with growth
    const maxMonths = 120
    const monthlySubsTargets = calculateMonthlySubscribers(
        targetSubscribers,
        growthType,
        growthSettings || null,
        maxMonths
    )

    let cumulativeProfit = 0
    let bepMonth = Infinity
    let monthsToFullCapacity = 0
    let previousMonthSubs = 0 // Track for POSTPAID

    for (let month = 1; month <= maxMonths; month++) {
        const subs = monthlySubsTargets[month - 1]
        const billingSubs = paymentType === 'POSTPAID' ? previousMonthSubs : subs
        const grossRev = billingSubs * arpu
        const revenue = grossRev * (1 - (nplTolerancePercent / 100))
        const profit = revenue - monthlyOpex
        cumulativeProfit += profit

        if (cumulativeProfit >= totalCapex && bepMonth === Infinity) {
            bepMonth = month
        }

        if (subs >= targetSubscribers && monthsToFullCapacity === 0) {
            monthsToFullCapacity = month
        }

        previousMonthSubs = subs
    }

    const roiPerYear = totalCapex > 0 && simpleProfit > 0 ? (simpleProfit * 12 / totalCapex) * 100 : 0;

    return { bepMonth, simpleBep, monthsToFullCapacity, roiPerYear }
}

export function calculateMonthlySubscribers(
    targetSubscribers: number,
    growthType: string,
    growthSettings: GrowthSettings | null,
    months: number
): number[] {
    const result: number[] = []
    if (!growthSettings) return Array(months).fill(0)

    for (let month = 1; month <= months; month++) {
        let subs = 0

        if (growthType === 'LINEAR') {
            const settings = growthSettings as LinearGrowthSettings
            subs = Math.min(settings.subscribersPerMonth * month, targetSubscribers)
        } else if (growthType === 'PERCENTAGE') {
            const settings = growthSettings as PercentageGrowthSettings
            const initialSubs = (settings.initialPercent / 100) * targetSubscribers
            if (month === 1) {
                subs = initialSubs
            } else {
                const addPerMonth = (settings.monthlyGrowthPercent / 100) * targetSubscribers
                subs = Math.min(initialSubs + (addPerMonth * (month - 1)), targetSubscribers)
            }
        } else if (growthType === 'CUSTOM') {
            const settings = growthSettings as CustomGrowthSettings
            const sortedMilestones = [...settings.milestones].sort((a, b) => a.month - b.month)

            let prevMilestone = { month: 0, percent: 0 }
            let nextMilestone = sortedMilestones[sortedMilestones.length - 1] || { month: 1, percent: 100 }

            for (const m of sortedMilestones) {
                if (m.month <= month) prevMilestone = m
                if (m.month >= month && m.month < nextMilestone.month) nextMilestone = m
            }

            if (prevMilestone.month === month) {
                subs = (prevMilestone.percent / 100) * targetSubscribers
            } else if (nextMilestone.month === month) {
                subs = (nextMilestone.percent / 100) * targetSubscribers
            } else {
                const range = nextMilestone.month - prevMilestone.month
                const progress = range > 0 ? (month - prevMilestone.month) / range : 0
                const percentAtMonth = prevMilestone.percent + (nextMilestone.percent - prevMilestone.percent) * progress
                subs = (percentAtMonth / 100) * targetSubscribers
            }
        }
        result.push(Math.round(subs))
    }
    return result
}

export default function RABList({ onEdit, onView, refreshKey }: RABListProps) {
    const { hasPermission } = usePermission()
    const canUpdate = hasPermission('mixradius_expenses:update') || hasPermission('expense:update')
    const canDelete = hasPermission('mixradius_expenses:delete') || hasPermission('expense:delete')

    const [data, setData] = useState<RABProject[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [showCompareModal, setShowCompareModal] = useState(false)

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const handleCompare = () => {
        if (selectedIds.length < 2) {
            toast.error('Pilih minimal 2 RAB untuk dibandingkan')
            return
        }
        if (selectedIds.length > 4) {
            toast.error('Maksimal membandingkan 4 RAB agar tampilan tetap nyaman')
            return
        }
        setShowCompareModal(true)
    }

    const selectedProjects = data.filter(p => selectedIds.includes(p.id))

    const handleExport = (project: RABProject) => {
        const headers = ['Nama Item', 'Kategori', 'Tipe', 'Kuantitas', 'Harga Satuan', 'Total Harga']
        const rows = project.items.map(item => [
            `"${item.name.replace(/"/g, '""')}"`,
            (item.expenseCategory && typeof item.expenseCategory === 'object') ? (item.expenseCategory.parent ? `${item.expenseCategory.parent.name} - ${item.expenseCategory.name}` : item.expenseCategory.name) : (item.category || '-'),
            item.expenseType || 'CAPEX',
            item.quantity.toString(),
            item.unitPrice.toString(),
            item.totalPrice.toString()
        ])

        const { bepMonth, monthsToFullCapacity } = calculateRealisticBEP(project)

        let growthModelDesc = '-'
        if (project.growthType === 'LINEAR') {
            const s = project.growthSettings as LinearGrowthSettings
            growthModelDesc = `Linear (${s?.subscribersPerMonth || 0} plg/Bulan)`
        } else if (project.growthType === 'PERCENTAGE') {
            const s = project.growthSettings as PercentageGrowthSettings
            growthModelDesc = `Persentase (Awal: ${s?.initialPercent || 0}%, Naik: ${s?.monthlyGrowthPercent || 0}%/Bulan)`
        } else if (project.growthType === 'CUSTOM') {
            growthModelDesc = 'Kustom (Berdasarkan Target Spesifik Bulan)'
        }

        const csvContent = [
            `Proyek: ${project.name}`,
            `Status: ${project.status}`,
            `Target Pelanggan: ${project.targetSubscribers || 0}`,
            `Model Pertumbuhan: ${growthModelDesc}`,
            `ARPU: ${project.arpu || 0}`,
            `Kapasitas Penuh (Bulan Ke-): ${monthsToFullCapacity || 'T/A'}`,
            `Estimasi Pengembalian CAPEX Keseluruhan: ${bepMonth === Infinity ? 'Tidak Terhingga' : bepMonth + ' Bulan'}`,
            `Recovery: ${project.investmentRecoveryType === 'PERCENTAGE' ? `${project.investmentRecoveryValue}% dari Profit/Bulan` : `${formatCurrency(project.investmentRecoveryValue || 0)}/Bulan`}`,
            `Durasi Kontrak: ${project.investmentDurationMonths || 12} Bulan`,
            `Investor Profit Share: ${project.investorProfitSharePercent}%`,
            '',
            ['Bulan ke', 'Revenue', 'Potensi NPL', 'Profit Kotor', 'Angsuran Modal', 'Sisa Investasi', 'Investor Share', 'Company Share'].join(','),
            ...(() => {
                let currentBalance = project.items
                    .filter(item => !item.expenseType || item.expenseType === 'CAPEX')
                    .reduce((sum, item) => sum + Number(item.totalPrice), 0)
                const recoveryType = project.investmentRecoveryType || 'PERCENTAGE'
                const recoveryValue = project.investmentRecoveryValue || 50
                const investorSharePercent = project.investorProfitSharePercent || 50
                const totalOpex = Number(project.projectedOpex || 0)
                const arpu = Number(project.arpu || 0)
                const maxTrackMonths = project.investmentDurationMonths || 12

                const monthlySubsTargets = calculateMonthlySubscribers(
                    project.targetSubscribers || 0,
                    project.growthType || 'LINEAR',
                    project.growthSettings || null,
                    maxTrackMonths
                )

                const results = []
                let previousMonthSubs = 0
                for (let i = 0; i < maxTrackMonths; i++) {
                    const monthIndex = i + 1
                    const subs = monthlySubsTargets[i]
                    const billingSubs = project.paymentType === 'POSTPAID' ? previousMonthSubs : subs
                    const grossTargetRev = billingSubs * arpu
                    const targetRevenue = grossTargetRev * (1 - ((project.nplTolerancePercent || 0) / 100))

                    const actualRecord = (project.actualAchievements || []).find(a => a.month === monthIndex)
                    const rev = actualRecord ? Number(actualRecord.actualRevenue) : targetRevenue
                    const grossProfit = rev - totalOpex

                    let recoveryInstallment = 0
                    const hasManualRecovery = actualRecord?.manualRecoveryInstallment !== undefined && actualRecord?.manualRecoveryInstallment !== null

                    if (hasManualRecovery) {
                        recoveryInstallment = Number(actualRecord.manualRecoveryInstallment)
                    } else if (currentBalance > 0 && grossProfit > 0) {
                        if (recoveryType === 'PERCENTAGE') {
                            recoveryInstallment = (recoveryValue / 100) * grossProfit
                        } else {
                            recoveryInstallment = recoveryValue
                        }
                        recoveryInstallment = Math.min(recoveryInstallment, currentBalance, grossProfit)
                    }

                    currentBalance -= recoveryInstallment
                    const netProfit = Math.max(0, grossProfit - recoveryInstallment)

                    const hasManualInvestor = actualRecord?.manualInvestorShare !== undefined && actualRecord?.manualInvestorShare !== null
                    const hasManualCompany = actualRecord?.manualCompanyShare !== undefined && actualRecord?.manualCompanyShare !== null
                    const hasManualPercent = actualRecord?.manualInvestorProfitSharePercent !== undefined && actualRecord?.manualInvestorProfitSharePercent !== null

                    const currentInvestorPercent = hasManualPercent ? Number(actualRecord.manualInvestorProfitSharePercent) : investorSharePercent

                    const investorShare = hasManualInvestor
                        ? Number(actualRecord.manualInvestorShare)
                        : ((currentInvestorPercent / 100) * netProfit)

                    const companyShare = hasManualCompany
                        ? Number(actualRecord.manualCompanyShare)
                        : (netProfit - investorShare)

                    results.push([
                        monthIndex,
                        rev,
                        grossTargetRev - targetRevenue,
                        grossProfit,
                        recoveryInstallment,
                        Math.max(0, currentBalance),
                        investorShare,
                        companyShare
                    ].join(','))
                    previousMonthSubs = subs
                }

                // Add Total row
                const finalTotals = results.reduce((acc, row) => {
                    const parts = row.split(',').map(Number)
                    return {
                        rev: acc.rev + (isNaN(parts[1]) ? 0 : parts[1]),
                        npl: acc.npl + (isNaN(parts[2]) ? 0 : parts[2]),
                        gross: acc.gross + (isNaN(parts[3]) ? 0 : parts[3]),
                        rec: acc.rec + (isNaN(parts[4]) ? 0 : parts[4]),
                        inv: acc.inv + (isNaN(parts[6]) ? 0 : parts[6]),
                        comp: acc.comp + (isNaN(parts[7]) ? 0 : parts[7])
                    }
                }, { rev: 0, npl: 0, gross: 0, rec: 0, inv: 0, comp: 0 })

                results.push(['TOTAL AKUMULASI', finalTotals.rev, finalTotals.npl, finalTotals.gross, finalTotals.rec, '', finalTotals.inv, finalTotals.comp].join(','))
                results.push(['TOTAL DITERIMA INVESTOR (Modal+Profit)', '', '', '', '', '', finalTotals.rec + finalTotals.inv, ''].join(','))
                results.push(['TOTAL DITERIMA PERUSAHAAN (Profit)', '', '', '', '', '', '', finalTotals.comp].join(','))

                return results
            })(),
            '',
            'DAFTAR ITEM',
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `RAB-${project.name.replace(/\s+/g, '-')}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleExportPDF = (project: RABProject) => {
        try {
            const doc = new jsPDF()
            const { bepMonth } = calculateRealisticBEP(project)

            // Header
            doc.setFontSize(16)
            doc.text(`Rencana Anggaran Biaya (RAB): ${project.name}`, 14, 20)

            doc.setFontSize(10)
            doc.setTextColor(100)
            doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, 14, 28)

            // Project Summary Details
            doc.setTextColor(0)
            doc.text(`Keterangan: ${project.description || '-'}`, 14, 38)
            doc.text(`Status: ${project.status}`, 14, 44)
            doc.text(`Site / Group: ${project.mixRadiusGroup?.name || project.site?.name || '-'}`, 14, 50)

            // Financial Metrics Title
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(79, 70, 229) // Indigo-600
            doc.text('Ringkasan Finansial', 14, 62)

            // Faint divider line
            doc.setDrawColor(229, 231, 235) // Gray-200
            doc.setLineWidth(0.5)
            doc.line(14, 66, 196, 66)

            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')

            const capexItems = project.items
                .filter(item => !item.expenseType || item.expenseType === 'CAPEX')
            const totalCapex = capexItems.reduce((sum, item) => sum + Number(item.totalPrice), 0)
            const contingencyAmount = Number(project.contingencyAmount || 0)
            const totalInvestment = totalCapex + contingencyAmount

            let growthModelDesc = '-'
            if (project.growthType === 'LINEAR') {
                const s = project.growthSettings as LinearGrowthSettings
                growthModelDesc = `Linear (${s?.subscribersPerMonth || 0} plg/Bulan)`
            } else if (project.growthType === 'PERCENTAGE') {
                const s = project.growthSettings as PercentageGrowthSettings
                growthModelDesc = `Persentase (Awal: ${s?.initialPercent || 0}%, Naik: ${s?.monthlyGrowthPercent || 0}%/Bulan)`
            } else if (project.growthType === 'CUSTOM') {
                growthModelDesc = 'Kustom (Berdasarkan Target Spesifik Bulan)'
            }

            const metrics = [
                ['Total CAPEX Dasar', formatCurrency(totalCapex)],
                [`Contingency (${project.contingencyPercent || 0}%)`, formatCurrency(contingencyAmount)],
                ['Total Investasi', formatCurrency(totalInvestment)],
                ['OPEX / Bulan', formatCurrency(Number(project.projectedOpex))],
                ['Target Pelanggan', `${project.targetSubscribers || 0} Pelanggan`],
                ['Model Pertumbuhan', growthModelDesc],
                ['Sistem Pembayaran', project.paymentType === 'POSTPAID' ? 'Pascabayar (Postpaid)' : 'Prabayar (Prepaid)'],
                ['Toleransi NPL (%)', `${project.nplTolerancePercent || 0}%`],
                ['Pengembalian Modal', project.investmentRecoveryType === 'PERCENTAGE' ? `${project.investmentRecoveryValue}% dari Profit/Bulan` : `${formatCurrency(project.investmentRecoveryValue || 0)}/Bulan`],
                ['Durasi Kontrak', `${project.investmentDurationMonths || 12} Bulan`],
                ['Bagi Hasil Investor', `${project.investorProfitSharePercent}%`],
                ['Bagi Hasil Perusahaan', `${100 - (project.investorProfitSharePercent || 50)}%`],
                ['Estimasi BEP Keseluruhan', bepMonth === Infinity ? 'Tidak Terhingga' : `${bepMonth} Bulan`]
            ]

            // AutoTable for metrics
            autoTable(doc, {
                startY: 72,
                body: metrics,
                theme: 'grid',
                styles: {
                    fontSize: 9,
                    cellPadding: 4,
                    lineColor: [229, 231, 235], // Gray-200
                    lineWidth: 0.1
                },
                columnStyles: {
                    0: {
                        fontStyle: 'normal',
                        cellWidth: 65,
                        fillColor: [249, 250, 251], // Gray-50
                        textColor: [75, 85, 99] // Gray-600
                    },
                    1: {
                        cellWidth: 117,
                        fontStyle: 'bold',
                        textColor: [17, 24, 39] // Gray-900
                    }
                },
                margin: { bottom: 20 }
            })

            // Tracking Pencapaian Table
            const actuals = project.actualAchievements || []
            const trackingHeaders = [['Bulan', 'Revenue', 'Potensi NPL', 'Profit Kotor', 'Angsuran Modal', 'Sisa Investasi', 'Investor', 'Company']]
            const trackingData: string[][] = []
            const maxTrackMonths = project.investmentDurationMonths || 12
            const recoveryType = project.investmentRecoveryType || 'PERCENTAGE'
            const recoveryValue = project.investmentRecoveryValue || 50
            const investorSharePercent = project.investorProfitSharePercent || 50

            const arpuVal = Number(project.arpu || 0)
            const totalOpex = Number(project.projectedOpex || 0)
            let currentBalance = totalCapex

            const monthlySubsTargets = calculateMonthlySubscribers(
                project.targetSubscribers || 0,
                project.growthType || 'LINEAR',
                project.growthSettings || null,
                maxTrackMonths
            )

            let previousSubs = 0

            let totalRev = 0
            let totalNpl = 0
            let totalGross = 0
            let totalRec = 0
            let totalInv = 0
            let totalComp = 0

            for (let i = 0; i < maxTrackMonths; i++) {
                const monthIndex = i + 1
                const subs = monthlySubsTargets[i]
                const billingSubs = project.paymentType === 'POSTPAID' ? previousSubs : subs
                const grossTargetRev = billingSubs * arpuVal
                const targetRevenue = grossTargetRev * (1 - ((project.nplTolerancePercent || 0) / 100))

                const actualRecord = actuals.find(a => a.month === monthIndex)
                const rev = actualRecord ? Number(actualRecord.actualRevenue) : targetRevenue
                const grossProfit = rev - totalOpex

                let recoveryInstallment = 0
                const hasManualRecovery = actualRecord?.manualRecoveryInstallment !== undefined && actualRecord?.manualRecoveryInstallment !== null

                if (hasManualRecovery) {
                    recoveryInstallment = Number(actualRecord.manualRecoveryInstallment)
                } else if (currentBalance > 0 && grossProfit > 0) {
                    if (recoveryType === 'PERCENTAGE') {
                        recoveryInstallment = (recoveryValue / 100) * grossProfit
                    } else {
                        recoveryInstallment = recoveryValue
                    }
                    recoveryInstallment = Math.min(recoveryInstallment, currentBalance, grossProfit)
                }

                currentBalance -= recoveryInstallment
                const netProfit = Math.max(0, grossProfit - recoveryInstallment)

                const hasManualInvestor = actualRecord?.manualInvestorShare !== undefined && actualRecord?.manualInvestorShare !== null
                const hasManualCompany = actualRecord?.manualCompanyShare !== undefined && actualRecord?.manualCompanyShare !== null
                const hasManualPercent = actualRecord?.manualInvestorProfitSharePercent !== undefined && actualRecord?.manualInvestorProfitSharePercent !== null

                const currentInvestorPercent = hasManualPercent ? Number(actualRecord.manualInvestorProfitSharePercent) : investorSharePercent

                const investorShare = hasManualInvestor
                    ? Number(actualRecord.manualInvestorShare)
                    : ((currentInvestorPercent / 100) * netProfit)

                const companyShare = hasManualCompany
                    ? Number(actualRecord.manualCompanyShare)
                    : (netProfit - investorShare)

                const nplAmount = actualRecord ? 0 : (grossTargetRev - targetRevenue)

                trackingData.push([
                    monthIndex.toString(),
                    formatCurrency(rev),
                    formatCurrency(nplAmount),
                    formatCurrency(grossProfit),
                    formatCurrency(recoveryInstallment),
                    formatCurrency(Math.max(0, currentBalance)),
                    formatCurrency(investorShare),
                    formatCurrency(companyShare)
                ])
                previousSubs = subs

                totalRev += rev
                totalNpl += nplAmount
                totalGross += grossProfit
                totalRec += recoveryInstallment
                totalInv += investorShare
                totalComp += companyShare
            }

            const docAsJspdf = doc as jsPDF & { lastAutoTable?: { finalY: number } }

            let currentY = docAsJspdf.lastAutoTable ? docAsJspdf.lastAutoTable.finalY + 12 : 100

            // RINGKASAN PEMBAGIAN AKHIR (Boxed Version)
            if (currentY > 230) {
                doc.addPage()
                currentY = 20
            }

            // Draw a rounded rectangle for the summary card
            const boxWidth = 182
            const boxHeight = 28
            doc.setFillColor(249, 250, 251) // Gray-50
            doc.setDrawColor(229, 231, 235) // Gray-200
            doc.setLineWidth(0.1)
            doc.roundedRect(14, currentY, boxWidth, boxHeight, 3, 3, 'FD')

            doc.setFontSize(9)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(79, 70, 229) // Indigo-600
            doc.text('RINGKASAN PEMBAGIAN AKHIR:', 20, currentY + 7)

            doc.setFontSize(8)
            doc.setTextColor(75, 85, 99) // Gray-600
            doc.setFont('helvetica', 'normal')
            doc.text('Total Hak Investor (Modal + Profit)', 20, currentY + 15)
            doc.text('Total Hak Perusahaan (Profit)', 20, currentY + 22)

            doc.setFontSize(9)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(17, 24, 39) // Gray-900 
            doc.text(formatCurrency(totalRec + totalInv), boxWidth - 10, currentY + 15, { align: 'right' })
            doc.text(formatCurrency(totalComp), boxWidth - 10, currentY + 22, { align: 'right' })

            currentY = currentY + boxHeight + 12

            if (currentY > 250) {
                doc.addPage()
                currentY = 20
            }

            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Tracking Pencapaian (Realisasi)', 14, currentY)

            autoTable(doc, {
                startY: currentY + 6,
                head: trackingHeaders,
                body: trackingData,
                foot: [[
                    'TOTAL',
                    formatCurrency(totalRev),
                    formatCurrency(totalNpl),
                    formatCurrency(totalGross),
                    formatCurrency(totalRec),
                    '',
                    formatCurrency(totalInv),
                    formatCurrency(totalComp)
                ]],
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' }, // Indigo-600
                footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                styles: { fontSize: 7, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 10 },
                    1: { halign: 'right', cellWidth: 23 },
                    2: { halign: 'right', cellWidth: 23 },
                    3: { halign: 'right', cellWidth: 24 },
                    4: { halign: 'right', cellWidth: 24 },
                    5: { halign: 'right', cellWidth: 25 },
                    6: { halign: 'right', cellWidth: 24 },
                    7: { halign: 'right', cellWidth: 25 }
                },
                showFoot: 'lastPage',
                margin: { bottom: 20 }
            })
            let currentTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

            if (currentTableY > 260) {
                doc.addPage()
                currentTableY = 20
            }
            // Items Table
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            const itemsY = currentTableY
            doc.text('Daftar Item & Biaya', 14, itemsY)

            const tableHeaders = [['Nama Item', 'Kategori', 'Tipe', 'Qty', 'Harga Satuan', 'Total Harga']]

            // Generate rows with WBS grouping if applicable
            const tableData: any[] = []
            const hasWbs = project.wbsGroups && project.wbsGroups.length > 0

            if (!hasWbs) {
                project.items.forEach(item => {
                    tableData.push([
                        item.name,
                        (item.expenseCategory && typeof item.expenseCategory === 'object') ? (item.expenseCategory.parent ? `${item.expenseCategory.parent.name} - ${item.expenseCategory.name}` : item.expenseCategory.name) : (item.category || '-'),
                        item.expenseType || 'CAPEX',
                        item.quantity.toString(),
                        formatCurrency(Number(item.unitPrice)),
                        formatCurrency(Number(item.totalPrice))
                    ])
                })
            } else {
                const groups = [...(project.wbsGroups || [])].sort((a, b) => a.order - b.order)
                const ungrouppedItems = project.items.filter(i => !(i as any).wbsId && !i.wbsGroupId)

                groups.forEach(wbs => {
                    const groupItems = project.items.filter(i => (i as any).wbsId === wbs.id || i.wbsGroupId === wbs.id)
                    if (groupItems.length === 0) return
                    const groupSubtotal = groupItems.reduce((sum, item) => sum + Number(item.totalPrice), 0)

                    tableData.push([
                        { content: wbs.name.toUpperCase(), colSpan: 5, styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
                        { content: formatCurrency(groupSubtotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [243, 244, 246] } }
                    ])

                    groupItems.forEach(item => {
                        tableData.push([
                            `  ${item.name}`, // Indent slightly
                            (item.expenseCategory && typeof item.expenseCategory === 'object') ? (item.expenseCategory.parent ? `${item.expenseCategory.parent.name} - ${item.expenseCategory.name}` : item.expenseCategory.name) : (item.category || '-'),
                            item.expenseType || 'CAPEX',
                            item.quantity.toString(),
                            formatCurrency(Number(item.unitPrice)),
                            formatCurrency(Number(item.totalPrice))
                        ])
                    })
                })

                if (ungrouppedItems.length > 0) {
                    const groupSubtotal = ungrouppedItems.reduce((sum, item) => sum + Number(item.totalPrice), 0)
                    tableData.push([
                        { content: 'LAIN-LAIN (BELUM DIGRUP)', colSpan: 5, styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
                        { content: formatCurrency(groupSubtotal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [243, 244, 246] } }
                    ])
                    ungrouppedItems.forEach(item => {
                        tableData.push([
                            `  ${item.name}`,
                            (item.expenseCategory && typeof item.expenseCategory === 'object') ? (item.expenseCategory.parent ? `${item.expenseCategory.parent.name} - ${item.expenseCategory.name}` : item.expenseCategory.name) : (item.category || '-'),
                            item.expenseType || 'CAPEX',
                            item.quantity.toString(),
                            formatCurrency(Number(item.unitPrice)),
                            formatCurrency(Number(item.totalPrice))
                        ])
                    })
                }
            }

            const totalItemsPrice = project.items.reduce((sum, item) => sum + Number(item.totalPrice), 0)

            autoTable(doc, {
                startY: itemsY + 6,
                head: tableHeaders,
                body: tableData,
                foot: [[
                    'TOTAL SELURUH ITEM',
                    '',
                    '',
                    '',
                    '',
                    formatCurrency(totalItemsPrice)
                ]],
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' }, // Indigo-600
                footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                styles: { fontSize: 8, cellPadding: 3 },
                columnStyles: {
                    3: { halign: 'center' },
                    4: { halign: 'right' },
                    5: { halign: 'right', fontStyle: 'bold' }
                },
                showFoot: 'lastPage',
                margin: { bottom: 20 }
            })

            // Disbursements Table
            const allDisbursements = project.items.reduce((acc, item) => {
                if (item.disbursements && item.disbursements.length > 0) {
                    item.disbursements.forEach(d => {
                        acc.push({
                            ...d,
                            itemName: item.name
                        })
                    })
                }
                return acc
            }, [] as any[])

            if (allDisbursements.length > 0) {
                // Sort by date chronologically
                allDisbursements.sort((a, b) => {
                    if (!a.estimatedDate) return 1
                    if (!b.estimatedDate) return -1
                    return new Date(a.estimatedDate).getTime() - new Date(b.estimatedDate).getTime()
                })

                let disbY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15
                if (disbY > 250) {
                    doc.addPage()
                    disbY = 20
                }

                doc.setFontSize(12)
                doc.setFont('helvetica', 'bold')
                doc.text('Jadwal Pencairan (Termin)', 14, disbY)

                const disbHeaders = [['No', 'Item', 'Keterangan Termin', 'Estimasi Tanggal', 'Persentase', 'Nominal Pencairan', 'Status']]
                const disbData = allDisbursements.map((d, i) => [
                    (i + 1).toString(),
                    d.itemName,
                    d.name || `Termin ${i + 1}`,
                    d.estimatedDate ? new Date(d.estimatedDate).toLocaleDateString('id-ID') : '-',
                    `${d.percentage}%`,
                    formatCurrency(Number(d.amount)),
                    d.isPaid ? 'Cair' : 'Menunggu'
                ])

                autoTable(doc, {
                    startY: disbY + 6,
                    head: disbHeaders,
                    body: disbData,
                    theme: 'striped',
                    headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' },
                    styles: { fontSize: 8, cellPadding: 3 },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 10 },
                        4: { halign: 'right' },
                        5: { halign: 'right', fontStyle: 'bold' },
                        6: { halign: 'center' }
                    }
                })
            }

            // Signature Section for APPROVED RABs
            if (project.status === 'APPROVED' && project.approvals && project.approvals.length >= 2) {
                let sigY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY + 15 || currentTableY + 20

                if (sigY > 240) {
                    doc.addPage()
                    sigY = 30
                }

                doc.setFontSize(10)
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(0, 0, 0)
                doc.text('Mengetahui & Menyetujui,', 14, sigY)

                // Get the first two approvers
                const approver1 = project.approvals[0]
                const approver2 = project.approvals[1]

                const sigYPos = sigY + 10
                const sigHeight = 25

                // First Approver (Left)
                doc.setFontSize(9)
                doc.text('Disetujui Oleh:', 20, sigYPos)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(79, 70, 229) // Indigo text for signature proxy
                doc.text('Telah Disetujui Secara Digital', 20, sigYPos + 12)
                doc.setTextColor(0, 0, 0)
                doc.setFont('helvetica', 'bold')
                doc.text(approver1.user.name || 'Unknown', 20, sigYPos + sigHeight)
                doc.setFontSize(8)
                doc.setFont('helvetica', 'normal')
                doc.text(approver1.user.role?.name || '-', 20, sigYPos + sigHeight + 5)

                // Second Approver (Right)
                const rightX = 120
                doc.setFontSize(9)
                doc.text('Disetujui Oleh:', rightX, sigYPos)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(79, 70, 229)
                doc.text('Telah Disetujui Secara Digital', rightX, sigYPos + 12)
                doc.setTextColor(0, 0, 0)
                doc.setFont('helvetica', 'bold')
                doc.text(approver2.user.name || 'Unknown', rightX, sigYPos + sigHeight)
                doc.setFontSize(8)
                doc.setFont('helvetica', 'normal')
                doc.text(approver2.user.role?.name || '-', rightX, sigYPos + sigHeight + 5)
            }

            // Save PDF
            doc.save(`RAB-${project.name.replace(/\\s+/g, '-')}.pdf`)
            toast.success('RAB berhasil diekspor ke PDF')
        } catch (error) {
            console.error('PDF generation error:', error)
            toast.error('Gagal membuat file PDF')
        }
    }

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/finance/rab-projects')
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                console.error('RAB fetch error:', res.status, errorData)
                throw new Error(errorData.error || `Gagal mengambil data RAB (status: ${res.status})`)
            }
            const result = await res.json()
            const rabData = Array.isArray(result) ? result : (result.data || [])
            setData(rabData)
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : 'Gagal mengambil data RAB')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData, refreshKey])

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah anda yakin ingin menghapus RAB ini?')) return

        try {
            const res = await fetch(`/api/finance/rab-projects/${id}`, {
                method: 'DELETE'
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || 'Gagal menghapus RAB')
            }
            toast.success('RAB berhasil dihapus')
            fetchData()
        } catch (_error) {
            toast.error('Gagal menghapus RAB')
        }
    }

    const handleDuplicate = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menduplikasi RAB ini?')) return

        setLoading(true)
        try {
            const res = await fetch(`/api/finance/rab-projects/${id}/copy`, {
                method: 'POST'
            })
            const json = await res.json()
            if (res.ok) {
                toast.success('RAB berhasil diduplikasi')
                fetchData()
            } else {
                toast.error(json.error || 'Gagal menduplikasi RAB')
            }
        } catch (_error) {
            toast.error('Gagal terhubung ke server')
        } finally {
            setLoading(false)
        }
    }

    const calculateTotalCapex = (project: RABProject) => {
        return project.items
            .filter(item => !item.expenseType || item.expenseType === 'CAPEX')
            .reduce((sum, item) => sum + Number(item.totalPrice), 0)
    }

    const getGrowthTypeLabel = (type?: string) => {
        switch (type) {
            case 'LINEAR': return 'Linear'
            case 'PERCENTAGE': return 'Persentase'
            case 'CUSTOM': return 'Kustom'
            default: return '-'
        }
    }

    return (
        <div className="space-y-4">
            {/* Bulk Actions Header */}
            {selectedIds.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
                    <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
                        {selectedIds.length} proyek dipilih
                    </span>
                    <button
                        onClick={handleCompare}
                        disabled={selectedIds.length < 2}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <HiOutlineDocumentDuplicate className="w-4 h-4" /> {/* Or a compare icon */}
                        Bandingkan {selectedIds.length > 1 ? `(${selectedIds.length})` : ''}
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <ResponsiveTable keyField="id"
                    data={data}
                    loading={loading}
                    emptyMessage={
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                            <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-full mb-3">
                                <HiOutlineCalculator className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-lg font-medium">Belum ada data RAB</p>
                            <p className="text-sm mt-1">Buat RAB baru untuk memulai perencanaan proyek</p>
                        </div>
                    }
                    columns={[
                        {
                            key: 'select',
                            header: '',
                            render: (item) => (
                                <div className="flex justify-center -ml-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(item.id)}
                                        onChange={() => toggleSelection(item.id)}
                                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-600 dark:bg-gray-700 dark:border-gray-600 dark:ring-offset-gray-800"
                                    />
                                </div>
                            )
                        },
                        {
                            key: 'name',
                            header: 'Nama Proyek',
                            render: (item) => (
                                <div>
                                    <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{item.description}</div>
                                </div>
                            )
                        },
                        {
                            key: 'site',
                            header: 'Site / Group',
                            render: (item) => {
                                const name = item.mixRadiusGroup?.name || item.site?.name
                                return name ? (
                                    <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                        <HiOutlineBuildingOffice className="w-4 h-4 text-gray-400" />
                                        {name}
                                    </div>
                                ) : (
                                    <span className="text-gray-400 italic text-sm">-</span>
                                )
                            }
                        },
                        {
                            key: 'target',
                            header: 'Target',
                            render: (item) => (
                                <div className="flex items-center gap-1.5 text-sm">
                                    <HiOutlineUsers className="w-4 h-4 text-indigo-400" />
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {item.targetSubscribers || '-'}
                                    </span>
                                </div>
                            )
                        },
                        {
                            key: 'growthType',
                            header: 'Model Growth',
                            render: (item) => (
                                <div className="flex items-center gap-1.5">
                                    <HiOutlineArrowTrendingUp className="w-4 h-4 text-purple-400" />
                                    <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded">
                                        {getGrowthTypeLabel(item.growthType)}
                                    </span>
                                </div>
                            )
                        },
                        {
                            key: 'totalCapex',
                            header: 'Total CAPEX',
                            render: (item) => (
                                <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                                    {formatCurrency(calculateTotalCapex(item))}
                                </span>
                            )
                        },
                        {
                            key: 'bep',
                            header: 'Est. BEP',
                            render: (item) => {
                                const { bepMonth, simpleBep } = calculateRealisticBEP(item)
                                const hasGrowth = item.targetSubscribers && item.arpu && item.growthSettings

                                return (
                                    <div className="space-y-1">
                                        <div className={`font-bold px-2 py-1 rounded-md text-xs inline-flex items-center gap-1 ${bepMonth === Infinity
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                            : bepMonth <= 24
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                            }`}>
                                            {bepMonth === Infinity ? '∞' : `${bepMonth} Bulan`}
                                            {hasGrowth && <HiOutlineArrowTrendingUp className="w-3 h-3" />}
                                        </div>
                                        {hasGrowth && simpleBep !== Infinity && (
                                            <div className="text-[10px] text-gray-400">
                                                Sederhana: {simpleBep.toFixed(1)} bln
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                        },
                        {
                            key: 'status',
                            header: 'Status',
                            render: (item) => (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded text-xs font-medium uppercase">
                                    {item.status || 'DRAFT'}
                                </span>
                            )
                        },
                        {
                            key: 'actions',
                            header: '',
                            render: (item: RABProject) => (
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => onView(item)}
                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                        title="Lihat Detail"
                                    >
                                        <HiOutlineEye className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleExport(item)}
                                        className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                        title="Export CSV"
                                    >
                                        <HiOutlineDocumentArrowDown className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleExportPDF(item)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        title="Export PDF"
                                    >
                                        <HiOutlineDocumentText className="w-5 h-5" />
                                    </button>
                                    {canUpdate && (
                                        <>
                                            <button
                                                onClick={() => onEdit(item)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <HiOutlinePencilSquare className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDuplicate(item.id)}
                                                className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                                                title="Duplikat (Copy)"
                                            >
                                                <HiOutlineDocumentDuplicate className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                            title="Hapus"
                                        >
                                            <HiOutlineTrash className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            )
                        }
                    ]}
                />
                {showCompareModal && (
                    <RABCompare
                        projects={selectedProjects}
                        isOpen={showCompareModal}
                        onClose={() => setShowCompareModal(false)}
                    />
                )}
            </div>
        </div>
    )
}
