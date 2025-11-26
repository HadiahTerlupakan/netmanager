import { NextRequest, NextResponse } from 'next/server'
import { getTagihanRepository, getPengeluaranRepository, getPemasukanRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

const convertJumlahToNumber = (jumlah: any): number => {
  if (typeof jumlah === 'bigint') return Number(jumlah)
  if (typeof jumlah === 'string') return Number(jumlah)
  return Number(jumlah) || 0
}

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

    const tagihanRepo = getTagihanRepository()
    const pengeluaranRepo = getPengeluaranRepository()
    const pemasukanRepo = getPemasukanRepository()

    // 1. Calculate Totals (Server-Side Aggregation)
    const [
      totalTagihanLunas,
      totalPemasukanManualBigInt,
      totalPengeluaranBigInt,
      totalCapexBigInt,
      totalOpexBigInt
    ] = await Promise.all([
      tagihanRepo.aggregateTotalByStatus('LUNAS'),
      pemasukanRepo.aggregateTotal(),
      pengeluaranRepo.aggregateTotal(),
      pengeluaranRepo.aggregateTotalByTipe('CAPEX'),
      pengeluaranRepo.aggregateTotalByTipe('OPEX')
    ])

    const totalPemasukanManual = Number(totalPemasukanManualBigInt)
    const totalPengeluaran = Number(totalPengeluaranBigInt)
    const totalCapex = Number(totalCapexBigInt)
    const totalOpex = Number(totalOpexBigInt)
    const totalPemasukan = totalTagihanLunas + totalPemasukanManual
    const saldo = totalPemasukan - totalPengeluaran

    // 2. Calculate Monthly Breakdown (Optimized Grouping)
    const [
      tagihanGrouped,
      pemasukanGrouped,
      pengeluaranGrouped
    ] = await Promise.all([
      tagihanRepo.groupByPeriode(),
      pemasukanRepo.groupByPeriode(),
      pengeluaranRepo.groupByPeriode()
    ])

    const cashflowPerBulan: Record<string, any> = {}

    // Process Tagihan Grouping
    tagihanGrouped.forEach((item: any) => {
      const key = `${item.periodeTahun}-${String(item.periodeBulan).padStart(2, '0')}`
      if (!cashflowPerBulan[key]) {
        cashflowPerBulan[key] = {
          bulan: item.periodeBulan,
          tahun: item.periodeTahun,
          pemasukan: 0,
          pengeluaran: 0,
          tagihanLunas: 0,
          tagihanBelumLunas: 0,
        }
      }
      if (item.status === 'LUNAS') {
        cashflowPerBulan[key].pemasukan += item._sum.total || 0
        cashflowPerBulan[key].tagihanLunas += item._count.id || 0
      } else {
        cashflowPerBulan[key].tagihanBelumLunas += item._count.id || 0
      }
    })

    // Process Pemasukan Manual Grouping
    pemasukanGrouped.forEach((item: any) => {
      const tanggal = new Date(item.tanggal)
      const bulan = tanggal.getMonth() + 1
      const tahun = tanggal.getFullYear()
      const key = `${tahun}-${String(bulan).padStart(2, '0')}`

      if (!cashflowPerBulan[key]) {
        cashflowPerBulan[key] = {
          bulan,
          tahun,
          pemasukan: 0,
          pengeluaran: 0,
          tagihanLunas: 0,
          tagihanBelumLunas: 0,
        }
      }
      const jumlah = convertJumlahToNumber(item.jumlah)
      cashflowPerBulan[key].pemasukan += jumlah
    })

    // Process Pengeluaran Grouping
    pengeluaranGrouped.forEach((item: any) => {
      const tanggal = new Date(item.tanggal)
      const bulan = tanggal.getMonth() + 1
      const tahun = tanggal.getFullYear()
      const key = `${tahun}-${String(bulan).padStart(2, '0')}`

      if (!cashflowPerBulan[key]) {
        cashflowPerBulan[key] = {
          bulan,
          tahun,
          pemasukan: 0,
          pengeluaran: 0,
          tagihanLunas: 0,
          tagihanBelumLunas: 0,
        }
      }
      const jumlah = convertJumlahToNumber(item.jumlah)
      cashflowPerBulan[key].pengeluaran += jumlah
    })

    const cashflowPerBulanArray = Object.values(cashflowPerBulan).sort((a: any, b: any) => {
      if (a.tahun !== b.tahun) return b.tahun - a.tahun
      return b.bulan - a.bulan
    })

    const summary = {
      totalPemasukan,
      totalPemasukanTagihan: totalTagihanLunas,
      totalPemasukanManual,
      totalPengeluaran,
      saldo,
      totalCapex,
      totalOpex,
    }

    console.log('[Cashflow API] Optimized Summary:', summary)

    return NextResponse.json({
      summary,
      perBulan: cashflowPerBulanArray,
    })
  } catch (error: any) {
    console.error('Error fetching cashflow:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
