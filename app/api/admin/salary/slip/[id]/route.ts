import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryRepository } from '@/modules/salary/repositories/SalaryRepository'

const salaryRepo = new SalaryRepository()

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/admin/salary/slip/[id] - Get salary slip in receipt format
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const salary = await salaryRepo.findById(id)

        if (!salary) {
            return NextResponse.json({ error: 'Salary not found' }, { status: 404 })
        }

        // Format as receipt/slip
        const slip = formatAsReceipt(salary)

        return NextResponse.json({ slip, salary })
    } catch (error) {
        console.error('Error generating slip:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate slip' },
            { status: 500 }
        )
    }
}

/**
 * Format salary data as receipt (struk) format
 */
function formatAsReceipt(salary: any): string {
    const LINE_WIDTH = 40
    const separator = '='.repeat(LINE_WIDTH)
    const dotLine = '-'.repeat(LINE_WIDTH)
    
    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount)
    }

    const padRight = (text: string, width: number) => text.padEnd(width)
    const padLeft = (text: string, width: number) => text.padStart(width)
    const centerText = (text: string) => {
        const padding = Math.floor((LINE_WIDTH - text.length) / 2)
        return ' '.repeat(padding) + text
    }

    const formatLine = (label: string, value: string, indent = 0) => {
        const spaces = ' '.repeat(indent)
        const labelWidth = LINE_WIDTH - value.length - indent - 1
        return `${spaces}${padRight(label, labelWidth)} ${value}`
    }

    let slip = ''
    
    // Header
    slip += separator + '\n'
    slip += centerText('SLIP GAJI') + '\n'
    slip += centerText(`${monthNames[salary.month - 1]} ${salary.year}`) + '\n'
    slip += separator + '\n'
    
    // Employee info
    slip += formatLine('Nama', salary.user.name || '-') + '\n'
    slip += formatLine('Tipe', salary.user.employeeType || 'KARYAWAN') + '\n'
    if (salary.user.departments?.name) {
        slip += formatLine('Departemen', salary.user.departments.name) + '\n'
    }
    if (salary.user.sites?.name) {
        slip += formatLine('Site', salary.user.sites.name) + '\n'
    }
    
    slip += dotLine + '\n'
    
    // Earnings
    slip += 'PENDAPATAN:\n'
    const earnings = salary.details.filter((d: any) => d.type === 'EARNING')
    for (const item of earnings) {
        const label = item.quantity 
            ? `${item.name} (${item.quantity}x)`
            : item.name
        slip += formatLine(label, formatCurrency(item.amount), 2) + '\n'
    }
    
    slip += dotLine + '\n'
    slip += formatLine('Total Pendapatan', formatCurrency(salary.totalEarnings)) + '\n'
    
    slip += dotLine + '\n'
    
    // Deductions
    const deductions = salary.details.filter((d: any) => d.type === 'DEDUCTION')
    if (deductions.length > 0) {
        slip += 'POTONGAN:\n'
        for (const item of deductions) {
            const label = item.quantity 
                ? `${item.name} (${item.quantity}x)`
                : item.name
            slip += formatLine(label, formatCurrency(item.amount), 2) + '\n'
        }
        slip += dotLine + '\n'
        slip += formatLine('Total Potongan', formatCurrency(salary.totalDeductions)) + '\n'
        slip += dotLine + '\n'
    }
    
    // Net salary
    slip += separator + '\n'
    slip += formatLine('GAJI BERSIH', formatCurrency(salary.netSalary)) + '\n'
    slip += separator + '\n'
    
    // Footer
    slip += '\n'
    slip += centerText('Status: ' + salary.status) + '\n'
    if (salary.paidAt) {
        const paidDate = new Date(salary.paidAt).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
        slip += centerText('Dibayar: ' + paidDate) + '\n'
    }
    slip += '\n'
    slip += centerText('Terima kasih') + '\n'
    slip += separator + '\n'

    return slip
}
