import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/modules/database'
import { logger } from '@/lib/logger'
import type { BarangMasuk, BarangKeluar } from '@prisma/client'

async function requireAdmin() {
  const session = await getServerSession(authConfig)
  if (!session) {
    return null
  }
  return session
}

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin() as { user: { id: string } } | null
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/opname/calculate')
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const gudangId = searchParams.get('gudangId')

    if (!gudangId) {
      return NextResponse.json(
        { error: 'Gudang ID harus diisi' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()

      const barangGudangs = await prisma.barangGudang.findMany({
        where: { gudangId },
        include: {
          barang: {
            select: {
              id: true,
              kode: true,
              nama: true,
              satuan: true,
              createdAt: true
            }
          },
          gudang: {
            select: {
              id: true,
              kode: true,
              nama: true
            }
          }
        },
        orderBy: { barang: { kode: 'asc' } }
      })

      if (barangGudangs.length === 0) {
        logger.dbOperation('findMany', 'BarangGudang+Relations', Date.now() - dbStart)
        return NextResponse.json({
          items: [],
          summary: {
            totalBarang: 0,
            totalStok: 0
          }
        })
      }

      const barangIds = barangGudangs.map(bg => bg.barang.id)

      // Fetch all relevant Masuk and Keluar records for these items in this gudang
      const [allMasuk, allKeluar] = await Promise.all([
        prisma.barangMasuk.findMany({
          where: { gudangId, barangId: { in: barangIds } }
        }),
        prisma.barangKeluar.findMany({
          where: { gudangId, barangId: { in: barangIds } }
        })
      ])

      // Group by barangId
      const masukByBarang: Record<string, BarangMasuk[]> = {}
      allMasuk.forEach(m => {
        if (!masukByBarang[m.barangId]) masukByBarang[m.barangId] = []
        masukByBarang[m.barangId].push(m)
      })

      const keluarByBarang: Record<string, BarangKeluar[]> = {}
      allKeluar.forEach(k => {
        if (!keluarByBarang[k.barangId]) keluarByBarang[k.barangId] = []
        keluarByBarang[k.barangId].push(k)
      })

      const items = barangGudangs.map((bg) => {
        const barangId = bg.barang.id
        const itemMasuk = masukByBarang[barangId] || []
        const itemKeluar = keluarByBarang[barangId] || []

        let stokBaru = 0
        let stokBekas = 0
        let stokRusak = 0

        itemMasuk.forEach((masuk) => {
          switch (masuk.kondisi) {
            case 'BARU': stokBaru += masuk.jumlah; break
            case 'BEKAS': stokBekas += masuk.jumlah; break
            case 'RUSAK': stokRusak += masuk.jumlah; break
            default: stokBaru += masuk.jumlah; break
          }
        })

        itemKeluar.forEach((keluar) => {
          switch (keluar.kondisi) {
            case 'BARU': stokBaru = Math.max(0, stokBaru - keluar.jumlah); break
            case 'BEKAS': stokBekas = Math.max(0, stokBekas - keluar.jumlah); break
            case 'RUSAK': stokRusak = Math.max(0, stokRusak - keluar.jumlah); break
            default: stokBaru = Math.max(0, stokBaru - keluar.jumlah); break
          }
        })

        const stokSistem = bg.stok
        let kondisiBaik = stokBaru
        const kondisiBekas = stokBekas
        const kondisiRusak = stokRusak

        const calculatedTotal = stokBaru + stokBekas + stokRusak
        if (calculatedTotal !== stokSistem && calculatedTotal > 0) {
          const difference = stokSistem - calculatedTotal
          kondisiBaik = Math.max(0, kondisiBaik + difference)
        }

        return {
          barangId: bg.barang.id,
          barangKode: bg.barang.kode,
          barangNama: bg.barang.nama,
          barangSatuan: bg.barang.satuan,
          gudangId: bg.gudang.id,
          gudangNama: bg.gudang.nama,
          stokSistem: stokSistem,
          stokFisik: stokSistem,
          kondisiBaik: kondisiBaik,
          kondisiRusak: kondisiRusak,
          kondisiExpire: kondisiBekas,
          lokasiPenyimpanan: bg.gudang.nama,
          nomorRak: '',
          nomorBox: '',
          pic: 'Gudang',
          suhuPenyimpanan: null as number | null,
          kelembaban: null as number | null,
          tanggalExpire: null as Date | null,
          nomorBatch: '',
          catatanDetail: `Stok sistem: ${stokSistem} (Baru: ${stokBaru}, Bekas: ${stokBekas}, Rusak: ${stokRusak}). Input stok fisik dan breakdown kondisi aktual.`
        }
      })

      const summary = {
        totalBarang: items.length,
        totalStok: items.reduce((sum, item) => sum + item.stokSistem, 0)
      }

      logger.dbOperation('findMany', 'BarangGudang+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/opname/calculate', 200, Date.now() - startTime, {
        userId: session.user.id,
        gudangId,
        totalBarang: items.length,
        totalStok: summary.totalStok
      })

      return NextResponse.json({
        items,
        summary
      })

    } finally {
    }
  } catch (error) {
    logger.error('Error getting stock opname data', error as Error, {
      path: '/api/inventory/opname/calculate',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal mengambil data stock opname' },
      { status: 500 }
    )
  }
}

