import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'FINANCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const totalTagihan = await prisma.tagihan.count()

    const tagihanByStatus = await prisma.tagihan.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { total: true },
    })

    const stats = {
      total: totalTagihan,
      belumLunas: 0,
      lunas: 0,
      terlambat: 0,
      totalNominalBelumLunas: 0,
      totalNominalLunas: 0,
      totalNominalTerlambat: 0,
    }

    tagihanByStatus.forEach((item) => {
      const count = item._count.id
      const total = Number(item._sum.total || 0)

      if (item.status === 'BELUM_LUNAS') {
        stats.belumLunas = count
        stats.totalNominalBelumLunas = total
      } else if (item.status === 'LUNAS') {
        stats.lunas = count
        stats.totalNominalLunas = total
      } else if (item.status === 'TERLAMBAT') {
        stats.terlambat = count
        stats.totalNominalTerlambat = total
      }
    })

    const mrrData = await prisma.tagihan.aggregate({
      _sum: { total: true },
      where: {
        status: 'LUNAS',
        periodeBulan: currentMonth,
        periodeTahun: currentYear,
      },
    })

    const mrr = Number(mrrData._sum.total || 0)

    const revenueByMonth = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const month = date.getMonth() + 1
      const year = date.getFullYear()

      const monthlyRevenue = await prisma.tagihan.aggregate({
        _sum: { total: true },
        where: {
          status: 'LUNAS',
          periodeBulan: month,
          periodeTahun: year,
        },
      })

      revenueByMonth.push({
        month,
        year,
        monthName: date.toLocaleString('id-ID', { month: 'short' }),
        revenue: Number(monthlyRevenue._sum.total || 0),
      })
    }

    const conversionRate = totalTagihan > 0 ? (stats.lunas / totalTagihan) * 100 : 0

    const overdueCount = await prisma.tagihan.count({
      where: {
        status: { in: ['BELUM_LUNAS', 'TERLAMBAT'] },
        jatuhTempo: { lt: now },
      },
    })

    const recentTagihan = await prisma.tagihan.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        pelanggan: {
          select: {
            nama: true,
            idPelanggan: true,
          },
        },
      },
    })

    return NextResponse.json({
      stats: {
        ...stats,
        mrr,
        conversionRate: Math.round(conversionRate * 100) / 100,
        overdueCount,
      },
      revenueByMonth,
      recentTagihan: recentTagihan.map((t) => ({
        id: t.id,
        noTagihan: t.noTagihan,
        pelangganNama: t.pelanggan.nama,
        pelangganId: t.pelanggan.idPelanggan,
        total: t.total,
        status: t.status,
        jatuhTempo: t.jatuhTempo,
        createdAt: t.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('Error getting tagihan stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
