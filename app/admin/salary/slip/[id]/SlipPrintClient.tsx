
'use client'

import { HiOutlinePrinter } from 'react-icons/hi2'
import { Button } from '@/components/ui/Button'

interface SalaryDetail {
    id: string
    name: string
    type: 'EARNING' | 'DEDUCTION'
    amount: number
    quantity?: number | null
}

interface Salary {
    month: number
    year: number
    user: {
        name: string
        employeeId?: string | null
        employeeType: string
        departments?: {
            name: string
        } | null
    }
    basicSalary: number
    details: SalaryDetail[]
    totalEarnings: number
    totalDeductions: number
    netSalary: number
    status: string
    paidAt?: string | null
}

interface SlipPrintClientProps {
    salary: Salary
}

export default function SlipPrintClient({ salary }: SlipPrintClientProps) {

    const settings = {
        companyName: 'NETMANAGER ISP',
        companyAddress: 'Jalan Raya Internet No. 1',
        companyPhone: '0812-3456-7890'
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount)
    }

    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]

    const earnings = salary.details.filter((d: SalaryDetail) => d.type === 'EARNING')
    const deductions = salary.details.filter((d: SalaryDetail) => d.type === 'DEDUCTION')

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8 flex justify-center items-start print:bg-white print:p-0">
            <style jsx global>{`
                @media print {
                    @page { margin: 0; }
                    body { margin: 1.6cm; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="bg-white p-8 w-[80mm] min-h-[100mm] shadow-lg font-mono text-sm print:shadow-none print:w-full">
                {/* Actions */}
                <div className="mb-6 flex justify-center no-print">
                    <Button onClick={() => window.print()}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                    >
                        <HiOutlinePrinter className="w-4 h-4" />
                        Print / Simpan PDF
                    </Button>
                </div>

                {/* Receipt Header */}
                <div className="text-center mb-4 border-b-2 border-dashed border-gray-300 pb-4">
                    <h1 className="font-bold text-lg mb-1">{settings.companyName}</h1>
                    <p className="text-xs text-gray-500 mb-1">{settings.companyAddress}</p>
                    <p className="text-xs text-gray-500">{settings.companyPhone}</p>
                </div>

                <div className="text-center mb-4">
                    <h2 className="font-bold border-2 border-gray-800 inline-block px-2 py-1 mb-2">SLIP GAJI</h2>
                    <p className="font-bold">{monthNames[salary.month - 1]} {salary.year}</p>
                </div>

                {/* Employee Info */}
                <div className="mb-4 text-xs space-y-1">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Nama:</span>
                        <span className="font-bold">{salary.user.name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">ID:</span>
                        <span>{salary.user.employeeId || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Jabatan:</span>
                        <span>{salary.user.departments?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <span>{salary.user.employeeType}</span>
                    </div>
                </div>

                <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

                {/* Earnings */}
                <div className="mb-4">
                    <h3 className="font-bold mb-2">PENDAPATAN</h3>
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span>Gaji Pokok</span>
                            <span>{formatCurrency(salary.basicSalary)}</span>
                        </div>
                        {earnings.map((item: SalaryDetail) => (
                            <div key={item.id} className="flex justify-between">
                                <span className={item.quantity ? 'text-xs' : ''}>
                                    {item.name}
                                    {item.quantity && ` (${item.quantity}x)`}
                                </span>
                                <span>{formatCurrency(item.amount)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between font-bold mt-2 pt-2 border-t border-gray-200">
                        <span>Total</span>
                        <span>{formatCurrency(salary.totalEarnings)}</span>
                    </div>
                </div>

                {/* Deductions */}
                {deductions.length > 0 && (
                    <div className="mb-4">
                        <h3 className="font-bold mb-2 text-red-600 print:text-black">POTONGAN</h3>
                        <div className="space-y-1">
                            {deductions.map((item: SalaryDetail) => (
                                <div key={item.id} className="flex justify-between text-red-600 print:text-black">
                                    <span className={item.quantity ? 'text-xs' : ''}>
                                        {item.name}
                                        {item.quantity && ` (${item.quantity}x)`}
                                    </span>
                                    <span>-{formatCurrency(item.amount)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between font-bold mt-2 pt-2 border-t border-gray-200 text-red-600 print:text-black">
                            <span>Total</span>
                            <span>-{formatCurrency(salary.totalDeductions)}</span>
                        </div>
                    </div>
                )}

                <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

                {/* Net Salary */}
                <div className="flex justify-between items-center text-lg font-bold mb-6">
                    <span>GAJI BERSIH</span>
                    <span>{formatCurrency(salary.netSalary)}</span>
                </div>

                {/* Footer */}
                <div className="text-center text-xs space-y-1 text-gray-500">
                    <p>Status: <span className="font-bold text-black">{salary.status}</span></p>
                    {salary.paidAt && (
                        <p>Dibayar: {new Date(salary.paidAt).toLocaleDateString('id-ID')}</p>
                    )}
                    <br />
                    <p className="italic">Dokumen ini sah dan diterbitkan secara otomatis oleh sistem.</p>
                </div>

            </div>
        </div>
    )
}
