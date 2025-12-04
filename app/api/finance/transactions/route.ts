import { NextRequest, NextResponse } from 'next/server'
import { getPengeluaranRepository, getPemasukanRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import FinanceAuthService from '@/lib/services/FinanceAuthService'
import { createSecureErrorResponse } from '@/lib/utils/secure-error-handler'

export async function GET(request: NextRequest) {
    try {
        // Proper authentication check
        const authResult = await FinanceAuthService.authenticate(request)
        if (!authResult.success) {
            return createSecureErrorResponse(
                authResult.error || 'Authentication failed',
                authResult.errorCode || 'UNAUTHORIZED',
                401
            )
        }

        // Log financial access
        await FinanceAuthService.logFinancialAccess(
            request,
            authResult.user!,
            'READ',
            'TRANSACTIONS'
        )

        // Parse Query Parameters
        const searchParams = request.nextUrl.searchParams
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const type = searchParams.get('type') || 'all' // 'all', 'pemasukan', 'pengeluaran'
        const startDateStr = searchParams.get('startDate')
        const endDateStr = searchParams.get('endDate')
        const category = searchParams.get('category')
        const paymentMethod = searchParams.get('paymentMethod')
        const search = searchParams.get('search')
        const period = searchParams.get('period') || 'monthly' // 'daily', 'weekly', 'monthly', 'yearly'

        // Calculate date range based on period if not explicitly provided
        let startDate = startDateStr ? new Date(startDateStr) : undefined
        let endDate = endDateStr ? new Date(endDateStr) : undefined
        
        if (!startDate && !endDate && period) {
            const today = new Date()
            endDate = today
            
            if (period === 'daily') {
                startDate = today
            } else if (period === 'weekly') {
                startDate = new Date(today)
                startDate.setDate(today.getDate() - 7)
            } else if (period === 'monthly') {
                startDate = new Date(today)
                startDate.setMonth(today.getMonth() - 1)
            } else if (period === 'yearly') {
                startDate = new Date(today)
                startDate.setFullYear(today.getFullYear() - 1)
            }
        }

        const pengeluaranRepo = getPengeluaranRepository()
        const pemasukanRepo = getPemasukanRepository()

        let items: { id: string, tanggal: Date, type: 'pemasukan' | 'pengeluaran' }[] = []

        // Fetch IDs and Dates based on type
        if (type === 'all' || type === 'pemasukan') {
            const pemasukanItems = await pemasukanRepo.findIdsAndDates(startDate, endDate, category, paymentMethod, search)
            items = [...items, ...pemasukanItems.map(i => ({ ...i, type: 'pemasukan' as const }))]
        }

        if (type === 'all' || type === 'pengeluaran') {
            const pengeluaranItems = await pengeluaranRepo.findIdsAndDates(startDate, endDate, category, paymentMethod, search)
            items = [...items, ...pengeluaranItems.map(i => ({ ...i, type: 'pengeluaran' as const }))]
        }

        // Sort by Date DESC
        items.sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime())

        // Pagination Logic
        const total = items.length
        const totalPages = Math.ceil(total / limit)
        const offset = (page - 1) * limit
        const paginatedItems = items.slice(offset, offset + limit)

        // Fetch Full Details for Paginated Items
        const fullDetails = await Promise.all(paginatedItems.map(async (item) => {
            if (item.type === 'pemasukan') {
                const detail = await pemasukanRepo.findById(item.id)
                return detail ? { ...detail, type: 'pemasukan' } : null
            } else {
                const detail = await pengeluaranRepo.findById(item.id)
                return detail ? { ...detail, type: 'pengeluaran' } : null
            }
        }))

        // Filter out nulls (should not happen usually)
        const validDetails = fullDetails.filter(item => item !== null)

        // Function to sanitize CSV values and prevent CSV injection
        const sanitizeCSVValue = (value: any): string => {
            if (value === null || value === undefined) {
                return ''
            }

            const stringValue = String(value)

            // Remove dangerous characters that could cause CSV injection
            // Remove =, +, -, @ at the beginning of cells (Excel formulas)
            if (/^[=+\-@]/.test(stringValue)) {
                return `'${stringValue}`
            }

            // Escape double quotes and wrap in quotes if contains comma, quote, or newline
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
                return `"${stringValue.replace(/"/g, '""')}"`
            }

            return stringValue
        }

        // CSV Headers
        const headers = [
            'Tanggal',
            'Jenis',
            'Tipe',
            'Kategori',
            'Deskripsi',
            'Jumlah',
            'Metode Pembayaran',
            'Nomor Bukti',
            'Catatan'
        ]

        // Build CSV content safely
        const csvRows = [headers.map(sanitizeCSVValue).join(',')]

        // Add data rows with sanitized values
        for (const detail of validDetails) {
            if (detail) {
                const row = [
                    detail.tanggal || '',
                    detail.type || '',
                    detail.tipe || '',
                    detail.kategori || '',
                    detail.deskripsi || '',
                    detail.jumlah?.toString() || '0',
                    detail.metodePembayaran || '',
                    detail.nomorBukti || '',
                    detail.catatan || ''
                ].map(sanitizeCSVValue)

                csvRows.push(row.join(','))
            }
        }

        const csvContent = csvRows.join('\n')
        
        return NextResponse.json({
            data: validDetails,
            exportData: csvContent,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        })

    } catch (error: any) {
        console.error('Error fetching transactions:', error)
        return createSecureErrorResponse(
            'Failed to fetch transactions',
            'INTERNAL_ERROR',
            500
        )
    }
}
