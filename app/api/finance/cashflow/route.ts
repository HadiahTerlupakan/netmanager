import { NextRequest, NextResponse } from 'next/server'
import { getTagihanRepository, getPengeluaranRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/finance/cashflow
 * Get cashflow data untuk finance portal
 * Bisa diakses oleh FINANCE atau ADMIN
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-finance-token')

    if (!token) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 401 })
    }

    // Verify token
    try {
      const tokenData = Buffer.from(token, 'base64').toString('utf8')
      const [userId] = tokenData.split(':')

      if (!userId) {
        return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
      }

      // Check token expiry
      const [, timestamp] = tokenData.split(':')
      const tokenTime = parseInt(timestamp)
      const now = Date.now()
      const tokenAge = now - tokenTime
      const maxAge = 24 * 60 * 60 * 1000

      if (tokenAge > maxAge) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 })
      }

      // Verify user exists and has FINANCE or ADMIN role
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      const allowedRoles = ['FINANCE', 'ADMIN'] as const
      if (!user || !allowedRoles.includes(user.role as any)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    } catch (parseError) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
    }

    const tagihanRepo = getTagihanRepository()
    const pengeluaranRepo = getPengeluaranRepository()
    const allTagihans = await tagihanRepo.findAll()
    const allPengeluarans = await pengeluaranRepo.findAll()

    // Hitung total pemasukan (tagihan yang sudah lunas)
    const totalPemasukan = allTagihans
      .filter(t => t.status === 'LUNAS')
      .reduce((sum, t) => sum + t.total, 0)

    // Hitung total pengeluaran
    const totalPengeluaran = allPengeluarans.reduce((sum, p) => sum + p.jumlah, 0)

    // Hitung saldo
    const saldo = totalPemasukan - totalPengeluaran

    // Group tagihan per bulan
    const cashflowPerBulan = allTagihans.reduce((acc, tagihan) => {
      const key = `${tagihan.periodeTahun}-${String(tagihan.periodeBulan).padStart(2, '0')}`
      if (!acc[key]) {
        acc[key] = {
          bulan: tagihan.periodeBulan,
          tahun: tagihan.periodeTahun,
          pemasukan: 0,
          pengeluaran: 0,
          tagihanLunas: 0,
          tagihanBelumLunas: 0,
        }
      }
      if (tagihan.status === 'LUNAS') {
        acc[key].pemasukan += tagihan.total
        acc[key].tagihanLunas += 1
      } else {
        acc[key].tagihanBelumLunas += 1
      }
      return acc
    }, {} as Record<string, {
      bulan: number
      tahun: number
      pemasukan: number
      pengeluaran: number
      tagihanLunas: number
      tagihanBelumLunas: number
    }>)

    // Group pengeluaran per bulan
    allPengeluarans.forEach((pengeluaran) => {
      const tanggal = new Date(pengeluaran.tanggal)
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
      cashflowPerBulan[key].pengeluaran += pengeluaran.jumlah
    })

    const cashflowPerBulanArray = Object.values(cashflowPerBulan).sort((a, b) => {
      if (a.tahun !== b.tahun) return b.tahun - a.tahun
      return b.bulan - a.bulan
    })

    return NextResponse.json({
      summary: {
        totalPemasukan,
        totalPengeluaran,
        saldo,
      },
      perBulan: cashflowPerBulanArray,
    })
  } catch (error: any) {
    console.error('Error fetching cashflow:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

