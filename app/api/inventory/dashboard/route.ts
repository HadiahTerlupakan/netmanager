import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/modules/database'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const session = await verifyAuth(req)
    if (!session) {
        return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    // Permission check
    if (!(await hasPermission('barang:read'))) {
        return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    try {
        const permissions = await getUserPermissions(session.id)
        const isSuper = isSuperAdmin(session)

        // Parse query parameters for custom date range
        const searchParams = req.nextUrl.searchParams
        const startDateParam = searchParams.get('startDate')
        const endDateParam = searchParams.get('endDate')

        // Site filter logic
        const hasRestriction = permissions.includes('barang:site_only') ||
                               permissions.includes('gudang:site_only')
        const siteId = (!isSuper && hasRestriction) ? session.siteId : undefined

        // Build filters
        const gudangFilter: Record<string, unknown> = { isActive: true }
        const transactionFilter: Record<string, unknown> = {}

        if (siteId) {
            gudangFilter.sites = { some: { id: siteId } }
            transactionFilter.gudang = { sites: { some: { id: siteId } } }
        }

        // Date ranges - support custom or default to 6 months
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        
        // Custom date range or default 6 months
        const customStartDate = startDateParam ? new Date(startDateParam) : null
        const customEndDate = endDateParam ? new Date(endDateParam) : null
        const trendStartDate = customStartDate || new Date(now.getFullYear(), now.getMonth() - 5, 1)
        const trendEndDate = customEndDate || now

        // ==================== PARALLEL QUERIES ====================
        const [
            totalJenisBarang,
            totalGudang,
            totalAsset,
            barangMasukBulanIni,
            barangKeluarBulanIni,
            stockData,
            lowStockItems,
            monthlyMasuk,
            monthlyKeluar,
            fastMovingData,
            slowMovingData,
            recentMasuk,
            recentKeluar,
            recentTransfer
        ] = await Promise.all([
            // Stats
            prisma.barang.count(),
            prisma.gudang.count({ where: gudangFilter }),
            prisma.asset.count({ where: { status: 'ACTIVE' } }),
            prisma.barangMasuk.count({ 
                where: { ...transactionFilter, tanggal: { gte: startOfMonth } } 
            }),
            prisma.barangKeluar.count({ 
                where: { ...transactionFilter, tanggal: { gte: startOfMonth } } 
            }),
            
            // Total stock and value
            prisma.barangGudang.aggregate({
                where: siteId ? { gudang: { sites: { some: { id: siteId } } } } : {},
                _sum: { stok: true }
            }),
            
            // Low stock count - simplified query
            prisma.barangGudang.count({
                where: {
                    stok: { lt: 10 } // Default low stock threshold
                }
            }).catch(() => 0), // Fallback if query fails
            
            // Monthly trend - Masuk (custom range or last 6 months)
            prisma.barangMasuk.groupBy({
                by: ['tanggal'],
                where: { 
                    ...transactionFilter, 
                    tanggal: { 
                        gte: trendStartDate,
                        lte: trendEndDate
                    } 
                },
                _sum: { jumlah: true }
            }),
            
            // Monthly trend - Keluar (custom range or last 6 months)
            prisma.barangKeluar.groupBy({
                by: ['tanggal'],
                where: { 
                    ...transactionFilter, 
                    tanggal: { 
                        gte: trendStartDate,
                        lte: trendEndDate
                    } 
                },
                _sum: { jumlah: true }
            }),
            
            // Fast moving items (top 10 by keluar)
            prisma.barangKeluar.groupBy({
                by: ['barangId'],
                where: { 
                    ...transactionFilter,
                    tanggal: { 
                        gte: trendStartDate,
                        lte: trendEndDate
                    }
                },
                _sum: { jumlah: true },
                orderBy: { _sum: { jumlah: 'desc' } },
                take: 10
            }),
            
            // Slow moving items (no activity in 30 days)
            prisma.barang.findMany({
                where: {
                    barang_keluar: {
                        none: {
                            tanggal: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                        }
                    }
                },
                select: {
                    id: true,
                    kode: true,
                    nama: true,
                    barang_keluar: {
                        orderBy: { tanggal: 'desc' },
                        take: 1,
                        select: { tanggal: true }
                    }
                },
                take: 10
            }),
            
            // Recent activities - Masuk
            prisma.barangMasuk.findMany({
                where: transactionFilter,
                orderBy: { tanggal: 'desc' },
                take: 10,
                include: {
                    barang: { select: { nama: true, kode: true } },
                    gudang: { select: { nama: true } },
                    user: { select: { name: true } }
                }
            }),
            
            // Recent activities - Keluar
            prisma.barangKeluar.findMany({
                where: transactionFilter,
                orderBy: { tanggal: 'desc' },
                take: 10,
                include: {
                    barang: { select: { nama: true, kode: true } },
                    gudang: { select: { nama: true } },
                    user: { select: { name: true } }
                }
            }),
            
            // Recent activities - Transfer
            prisma.transferAntarGudang.findMany({
                orderBy: { tanggal: 'desc' },
                take: 10,
                include: {
                    barang: { select: { nama: true, kode: true } },
                    gudangDari: { select: { nama: true } },
                    gudangKe: { select: { nama: true } },
                    createdBy: { select: { name: true } }
                }
            })
        ])

        // ==================== PROCESS DATA ====================
        
        // Process monthly trend
        const monthlyTrend = processMonthlyTrend(monthlyMasuk, monthlyKeluar, trendStartDate, trendEndDate)
        
        // Get barang details for fast moving
        const fastMovingBarangIds = fastMovingData.map(f => f.barangId)
        const fastMovingBarangs = await prisma.barang.findMany({
            where: { id: { in: fastMovingBarangIds } },
            select: { id: true, kode: true, nama: true }
        })
        
        const fastMoving = fastMovingData.map(f => {
            const barang = fastMovingBarangs.find(b => b.id === f.barangId)
            return {
                id: f.barangId,
                kode: barang?.kode || '-',
                nama: barang?.nama || 'Unknown',
                totalKeluar: f._sum.jumlah || 0
            }
        })
        
        // Process slow moving
        const slowMoving = slowMovingData.map(b => ({
            id: b.id,
            kode: b.kode,
            nama: b.nama,
            lastMovement: b.barang_keluar[0]?.tanggal || null,
            daysSinceLastMove: b.barang_keluar[0]?.tanggal 
                ? Math.floor((Date.now() - new Date(b.barang_keluar[0].tanggal).getTime()) / (1000 * 60 * 60 * 24))
                : null
        }))
        
        // Get stock alerts
        const alerts = await getStockAlerts(siteId)
        
        // Process recent activities
        const recentActivities = processRecentActivities(recentMasuk, recentKeluar, recentTransfer)

        return NextResponse.json({
            success: true,
            data: {
                stats: {
                    totalJenisBarang,
                    totalStokUnit: stockData._sum.stok || 0,
                    totalGudang,
                    totalAsset,
                    lowStockItems,
                    barangMasukBulanIni,
                    barangKeluarBulanIni
                },
                monthlyTrend,
                fastMoving,
                slowMoving,
                alerts,
                recentActivities
            }
        })

    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Terjadi kesalahan')
        logger.error('Error fetching inventory dashboard:', err)
        return NextResponse.json(
            { error: 'Gagal memuat data dashboard inventaris' },
            { status: 500 }
        )
    }
}

interface MonthlyData {
    tanggal: Date;
    _sum: {
        jumlah: number | null;
    };
}

// Helper: Process Monthly Trend
function processMonthlyTrend(masukData: MonthlyData[], keluarData: MonthlyData[], startDate: Date, endDate: Date) {
    const months: { [key: string]: { masuk: number; keluar: number } } = {}
    
    // Calculate number of months between start and end
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                       (endDate.getMonth() - startDate.getMonth()) + 1
    const numMonths = Math.max(1, Math.min(monthsDiff, 24)) // Cap at 24 months
    
    // Initialize months in range
    for (let i = 0; i < numMonths; i++) {
        const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        months[key] = { masuk: 0, keluar: 0 }
    }
    
    // Aggregate masuk
    masukData.forEach(item => {
        const date = new Date(item.tanggal)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (months[key]) {
            months[key].masuk += item._sum.jumlah || 0
        }
    })
    
    // Aggregate keluar
    keluarData.forEach(item => {
        const date = new Date(item.tanggal)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (months[key]) {
            months[key].keluar += item._sum.jumlah || 0
        }
    })
    
    return Object.entries(months).map(([key, value]) => {
        const [yearStr, monthStr] = key.split('-')
        const date = new Date(parseInt(yearStr || '0'), parseInt(monthStr || '0') - 1, 1)
        return {
            month: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
            masuk: value.masuk,
            keluar: value.keluar
        }
    })
}

// Helper: Get Stock Alerts
async function getStockAlerts(siteId?: string) {
    const alerts: Array<{
        barangId: string;
        barangKode: string;
        barangNama: string;
        gudangId: string;
        gudangNama: string;
        currentStock: number;
        minStock: number;
        status: string;
    }> = []
    
    // Find items with low stock based on RestockSettings
    const settings = await prisma.restockSettings.findMany({
        where: { 
            isActive: true,
            ...(siteId ? { gudang: { sites: { some: { id: siteId } } } } : {})  
        },
        include: {
            barang: { select: { id: true, kode: true, nama: true } },
            gudang: { select: { id: true, nama: true } }
        }
    })
    
    for (const setting of settings) {
        const stock = await prisma.barangGudang.findUnique({
            where: {
                barangId_gudangId: {
                    barangId: setting.barangId,
                    gudangId: setting.gudangId
                }
            }
        })
        
        const currentStock = stock?.stok || 0
        if (currentStock < setting.minStok) {
            alerts.push({
                barangId: setting.barang.id,
                barangKode: setting.barang.kode,
                barangNama: setting.barang.nama,
                gudangId: setting.gudang.id,
                gudangNama: setting.gudang.nama,
                currentStock,
                minStock: setting.minStok,
                status: currentStock === 0 ? 'CRITICAL' : 'LOW'
            })
        }
    }
    
    return alerts.sort((a, b) => {
        if (a.status === 'CRITICAL' && b.status !== 'CRITICAL') return -1
        if (a.status !== 'CRITICAL' && b.status === 'CRITICAL') return 1
        return a.currentStock - b.currentStock
    }).slice(0, 10)
}

interface ActivityItem {
    barang?: { nama?: string; kode?: string };
    gudang?: { nama?: string };
    jumlah: number;
    user?: { name?: string };
    tanggal: Date;
}

interface TransferItem {
    barang?: { nama?: string; kode?: string };
    gudangDari?: { nama?: string };
    gudangKe?: { nama?: string };
    jumlah: number;
    createdBy?: { name?: string };
    tanggal: Date;
}

// Helper: Process Recent Activities
function processRecentActivities(masuk: ActivityItem[], keluar: ActivityItem[], transfer: TransferItem[]) {
    const activities: Array<{
        type: string;
        barang: string;
        kode: string;
        gudang: string;
        jumlah: number;
        user: string;
        timestamp: Date;
    }> = []
    
    masuk.forEach(item => {
        activities.push({
            type: 'MASUK',
            barang: item.barang?.nama || '-',
            kode: item.barang?.kode || '-',
            gudang: item.gudang?.nama || '-',
            jumlah: item.jumlah,
            user: item.user?.name || '-',
            timestamp: item.tanggal
        })
    })
    
    keluar.forEach(item => {
        activities.push({
            type: 'KELUAR',
            barang: item.barang?.nama || '-',
            kode: item.barang?.kode || '-',
            gudang: item.gudang?.nama || '-',
            jumlah: item.jumlah,
            user: item.user?.name || '-',
            timestamp: item.tanggal
        })
    })
    
    transfer.forEach(item => {
        activities.push({
            type: 'TRANSFER',
            barang: item.barang?.nama || '-',
            kode: item.barang?.kode || '-',
            gudang: `${item.gudangDari?.nama} → ${item.gudangKe?.nama}`,
            jumlah: item.jumlah,
            user: item.createdBy?.name || '-',
            timestamp: item.tanggal
        })
    })
    
    return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20)
}
