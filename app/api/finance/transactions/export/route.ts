import { NextRequest, NextResponse } from 'next/server'
import { getPengeluaranRepository, getPemasukanRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const token = request.headers.get('x-finance-token')
        let userId: string | undefined

        if (token) {
            // Verify finance token
            try {
                const tokenData = Buffer.from(token, 'base64').toString('utf8')
                const [uid, timestamp] = tokenData.split(':')
                userId = uid

                if (!userId) {
                    return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
                }

                // Check token expiry
                const tokenTime = parseInt(timestamp)
                const now = Date.now()
                const tokenAge = now - tokenTime
                const maxAge = 24 * 60 * 60 * 1000

                if (tokenAge > maxAge) {
                    return NextResponse.json({ error: 'Token expired' }, { status: 401 })
                }
            } catch (parseError) {
                return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
            }
        } else {
            // Verify NextAuth session
            const session = await getServerSession(authConfig)
            if (session?.user?.id) {
                userId = session.user.id
            } else {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        // Verify user exists and has FINANCE or ADMIN role
        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        const allowedRoles = ['FINANCE', 'ADMIN'] as const
        if (!user || !allowedRoles.includes(user.role as any)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Parse Query Parameters
        const searchParams = request.nextUrl.searchParams
        const format = searchParams.get('format') || 'csv' // 'csv' or 'excel'
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

        let items: any[] = []

        // Fetch data based on type
        if (type === 'all' || type === 'pemasukan') {
            const pemasukanItems = await pemasukanRepo.findByFilters(startDate, endDate, category || undefined, paymentMethod || undefined, search || undefined)
            items = [...items, ...pemasukanItems.map(item => ({ ...item, type: 'pemasukan' }))]
        }

        if (type === 'all' || type === 'pengeluaran') {
            const pengeluaranItems = await pengeluaranRepo.findByFilters(startDate, endDate, category || undefined, paymentMethod || undefined, search || undefined)
            items = [...items, ...pengeluaranItems.map(item => ({ ...item, type: 'pengeluaran' }))]
        }

        // Sort by Date DESC
        items.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())

        // Format data for export
        const exportData: Record<string, string | number>[] = items.map(item => ({
            'Tanggal': new Date(item.tanggal).toLocaleDateString('id-ID'),
            'Jenis': item.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
            'Tipe': item.type === 'pengeluaran' && item.tipePengeluaran ? item.tipePengeluaran : '-',
            'Kategori': item.kategori,
            'Deskripsi': item.deskripsi,
            'Jumlah': typeof item.jumlah === 'bigint' ? Number(item.jumlah) : item.jumlah,
            'Metode Pembayaran': item.metodeBayar || '-',
            'Catatan': item.catatan || '-',
            'Dibuat Oleh': item.createdByUser?.name || item.createdByUser?.email || '-',
        }))

        if (format === 'csv') {
            // Convert to CSV
            const headers = Object.keys(exportData[0] || {})
            const csvContent = [
                headers.join(','),
                ...exportData.map(row =>
                    headers.map(header => {
                        const value = row[header]
                        // Handle values that contain commas or quotes
                        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                            return `"${value.replace(/"/g, '""')}"`
                        }
                        return value
                    }).join(',')
                )
            ].join('\n')

            return new NextResponse(csvContent, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="cashflow-transactions.csv"`,
                },
            })
        } else {
            // For Excel format, we'll use a simple approach with CSV that can be opened in Excel
            // In a real implementation, you might want to use a library like xlsx
            const headers = Object.keys(exportData[0] || {})
            const csvContent = [
                headers.join(','),
                ...exportData.map(row =>
                    headers.map(header => {
                        const value = row[header]
                        // Handle values that contain commas or quotes
                        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                            return `"${value.replace(/"/g, '""')}"`
                        }
                        return value
                    }).join(',')
                )
            ].join('\n')

            return new NextResponse(csvContent, {
                headers: {
                    'Content-Type': 'application/vnd.ms-excel',
                    'Content-Disposition': `attachment; filename="cashflow-transactions.xlsx"`,
                },
            })
        }

    } catch (error: any) {
        console.error('Error exporting transactions:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
