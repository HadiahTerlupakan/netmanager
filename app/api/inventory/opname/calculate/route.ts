import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

interface CalculatedStockOpname {
  barangId: string
  gudangId: string
  stokSistem: number
  stokFisik: number
  kondisiBaik: number
  kondisiRusak: number
  kondisiExpire: number
  lokasiPenyimpanan: string
  nomorRak?: string
  nomorBox?: string
  pic?: string
  suhuPenyimpanan?: number
  kelembaban?: number
  tanggalExpire?: Date
  nomorBatch?: string
  catatanDetail: string
}

/**
 * GET /api/inventory/opname/calculate
 * Get current stock data for stock opname
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/opname/calculate')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

      // Get all barang in the specified gudang
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

      // Transform data for frontend - use BarangGudang.stok as total, but calculate condition breakdown from transactions
      const items = await Promise.all(barangGudangs.map(async (bg) => {
        // Get condition breakdown from transaction history
        const stockByCondition = await getStockByCondition(bg.barang.id, bg.gudang.id)

        // Use BarangGudang.stok as the authoritative total
        // But show condition breakdown from transaction history  
        const stokSistem = bg.stok

        // Map transaction conditions to UI conditions:
        // - BARU → kondisiBaik (good/new)
        // - BEKAS → kondisiExpire (repurposed for "used" items since no separate field)
        // - RUSAK → kondisiRusak (damaged)
        let kondisiBaik = stockByCondition.stokBaru
        let kondisiBekas = stockByCondition.stokBekas // Use kondisiExpire field for BEKAS
        let kondisiRusak = stockByCondition.stokRusak

        // If there's a discrepancy between calculated and stored stock,
        // adjust the kondisiBaik to make up the difference (maintain consistency)
        const calculatedTotal = stockByCondition.stokBaru + stockByCondition.stokBekas + stockByCondition.stokRusak
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
          stokSistem: stokSistem, // Use BarangGudang.stok as authoritative
          stokFisik: stokSistem, // Default to system stock
          kondisiBaik: kondisiBaik, // BARU only
          kondisiRusak: kondisiRusak, // RUSAK
          kondisiExpire: kondisiBekas, // Repurposed for BEKAS (used items)
          lokasiPenyimpanan: bg.gudang.nama,
          nomorRak: '',
          nomorBox: '',
          pic: 'Gudang',
          suhuPenyimpanan: null,
          kelembaban: null,
          tanggalExpire: null,
          nomorBatch: '',
          catatanDetail: `Stok sistem: ${stokSistem} (Baru: ${stockByCondition.stokBaru}, Bekas: ${stockByCondition.stokBekas}, Rusak: ${stockByCondition.stokRusak}). Input stok fisik dan breakdown kondisi aktual.`
        }
      }))

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
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error getting stock opname data', error, {
      path: '/api/inventory/opname/calculate',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal mengambil data stock opname' },
      { status: 500 }
    )
  }
}

// Helper function to calculate stock by condition (same as in barang keluar API)
async function getStockByCondition(barangId: string, gudangId: string) {
  // Get ALL transactions for this barang to calculate current condition breakdown
  const [masukData, keluarData] = await Promise.all([
    prisma.barangMasuk.findMany({
      where: { barangId, gudangId },
      orderBy: { tanggal: 'desc' }
    }),
    prisma.barangKeluar.findMany({
      where: { barangId, gudangId },
      orderBy: { tanggal: 'desc' }
    })
  ])

  // Calculate current stock by condition
  let stokBaru = 0
  let stokBekas = 0
  let stokRusak = 0

  // Process barang masuk
  masukData.forEach((masuk: any) => {
    switch (masuk.kondisi) {
      case 'BARU':
        stokBaru += masuk.jumlah
        break
      case 'BEKAS':
        stokBekas += masuk.jumlah
        break
      case 'RUSAK':
        stokRusak += masuk.jumlah
        break
      default:
        stokBaru += masuk.jumlah
        break
    }
  })

  // Process barang keluar
  keluarData.forEach((keluar: any) => {
    switch (keluar.kondisi) {
      case 'BARU':
        stokBaru = Math.max(0, stokBaru - keluar.jumlah)
        break
      case 'BEKAS':
        stokBekas = Math.max(0, stokBekas - keluar.jumlah)
        break
      case 'RUSAK':
        stokRusak = Math.max(0, stokRusak - keluar.jumlah)
        break
      default:
        stokBaru = Math.max(0, stokBaru - keluar.jumlah)
        break
    }
  })

  return {
    stokBaru,
    stokBekas,
    stokRusak,
    totalStok: stokBaru + stokBekas + stokRusak
  }
}

// Helper functions to get data from actual transactions
async function getActualTransactionData(barangId: string, gudangId: string) {
  // Get ALL transactions for this barang to get complete picture
  const [masukData, keluarData] = await Promise.all([
    prisma.barangMasuk.findMany({
      where: {
        barangId,
        gudangId
      },
      orderBy: { tanggal: 'desc' }
      // No limit - get all transactions
    }),
    prisma.barangKeluar.findMany({
      where: {
        barangId,
        gudangId
      },
      orderBy: { tanggal: 'desc' }
      // No limit - get all transactions
    })
  ])

  return {
    masukData,
    keluarData,
    totalMasuk: masukData.reduce((sum, item) => sum + item.jumlah, 0),
    totalKeluar: keluarData.reduce((sum, item) => sum + item.jumlah, 0)
  }
}

function calculateBreakdownFromTransactions(transaksiData: any, stokSistem: number): { baik: number; rusak: number; expire: number } {
  if (stokSistem === 0) return { baik: 0, rusak: 0, expire: 0 }

  // Count ALL items by condition from ALL masuk transactions (complete history)
  let totalBaik = 0
  let totalRusak = 0
  let totalExpire = 0

  // Process ALL barang masuk (complete history)
  transaksiData.masukData.forEach((masuk: any) => {
    switch (masuk.kondisi) {
      case 'BARU':
        totalBaik += masuk.jumlah
        break
      case 'BEKAS':
        totalBaik += masuk.jumlah // BEKAS is still usable, so it goes to baik category
        break
      case 'RUSAK':
        totalRusak += masuk.jumlah
        break
      default:
        // For any unknown condition, assume it's usable
        totalBaik += masuk.jumlah
        break
    }
  })

  // Process ALL barang keluar (remove from appropriate categories)
  transaksiData.keluarData.forEach((keluar: any) => {
    switch (keluar.kondisi) {
      case 'BARU':
      case 'BEKAS':
        totalBaik = Math.max(0, totalBaik - keluar.jumlah)
        break
      case 'RUSAK':
        totalRusak = Math.max(0, totalRusak - keluar.jumlah)
        break
      default:
        // Default to removing from good items for unknown conditions
        totalBaik = Math.max(0, totalBaik - keluar.jumlah)
        break
    }
  })

  // The calculated breakdown represents the actual current state
  const calculatedTotal = totalBaik + totalRusak + totalExpire

  // Use system stock as the authoritative source, but maintain the breakdown proportions
  if (calculatedTotal > 0) {
    // If we have calculated values, adjust them to match system stock
    // This handles cases where there might be data entry issues or missing transactions
    if (calculatedTotal !== stokSistem) {
      const adjustmentFactor = stokSistem / calculatedTotal

      let adjustedBaik = Math.round(totalBaik * adjustmentFactor)
      let adjustedRusak = Math.round(totalRusak * adjustmentFactor)
      let adjustedExpire = Math.round(totalExpire * adjustmentFactor)

      // Fix rounding to ensure total matches
      const adjustedTotal = adjustedBaik + adjustedRusak + adjustedExpire
      if (adjustedTotal !== stokSistem) {
        const difference = stokSistem - adjustedTotal
        // Add difference to the category with most items
        if (adjustedBaik >= adjustedRusak && adjustedBaik >= adjustedExpire) {
          adjustedBaik += difference
        } else if (adjustedRusak >= adjustedBaik && adjustedRusak >= adjustedExpire) {
          adjustedRusak += difference
        } else {
          adjustedExpire += difference
        }
      }

      return { baik: adjustedBaik, rusak: adjustedRusak, expire: adjustedExpire }
    } else {
      // Exact match, use calculated values
      return { baik: totalBaik, rusak: totalRusak, expire: totalExpire }
    }
  } else {
    // No transaction data, default to all good items
    return { baik: stokSistem, rusak: 0, expire: 0 }
  }
}

function getStorageLocationsFromTransactions(transaksiData: any) {
  // Get most recent location from transactions
  const allTransactions = [
    ...transaksiData.masukData.map((item: any) => ({ ...item, type: 'masuk' })),
    ...transaksiData.keluarData.map((item: any) => ({ ...item, type: 'keluar' }))
  ].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())

  const latestTransaction = allTransactions[0]

  return {
    lokasiPenyimpanan: latestTransaction?.lokasiPenyimpanan || '',
    nomorRak: latestTransaction?.nomorRak || '',
    nomorBox: latestTransaction?.nomorBox || '',
    suhu: latestTransaction?.suhuPenyimpanan ? parseFloat(latestTransaction.suhuPenyimpanan) : undefined,
    kelembaban: latestTransaction?.kelembaban ? parseFloat(latestTransaction.kelembaban) : undefined
  }
}

function getActualPIC(transaksiData: any) {
  // Get PIC from most recent transaction
  const allTransactions = [
    ...transaksiData.masukData,
    ...transaksiData.keluarData
  ].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())

  return allTransactions[0]?.pic || 'Gudang'
}

function getBatchInfo(transaksiData: any) {
  // Get batch info from transactions
  const allTransactions = [
    ...transaksiData.masukData,
    ...transaksiData.keluarData
  ].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())

  const latestTransaction = allTransactions[0]

  return {
    nomorBatch: latestTransaction?.nomorBatch || '',
    tanggalExpire: latestTransaction?.tanggalExpire ? new Date(latestTransaction.tanggalExpire) : undefined
  }
}

function generateNotesFromTransactions(transaksiData: any, stokSistem: number, baik: number, rusak: number, expire: number): string {
  if (stokSistem === 0) return 'Stok habis'

  let notes = `Stok sistem: ${stokSistem}, Breakdown aktual:`

  // Count by condition from masuk transactions for detailed breakdown
  const masukByCondition: Record<string, number> = {
    BARU: 0,
    BEKAS: 0,
    RUSAK: 0
  }

  transaksiData.masukData.forEach((masuk: any) => {
    const kondisi: string = masuk.kondisi || 'BARU'
    if (kondisi in masukByCondition) {
      masukByCondition[kondisi] += masuk.jumlah
    } else {
      masukByCondition.BARU += masuk.jumlah
    }
  })

  // Add details about incoming items by condition
  if (masukByCondition.BARU > 0) {
    notes += ` Masuk (Baru): ${masukByCondition.BARU}`
  }
  if (masukByCondition.BEKAS > 0) {
    notes += ` Masuk (Bekas): ${masukByCondition.BEKAS}`
  }
  if (masukByCondition.RUSAK > 0) {
    notes += ` Masuk (Rusak): ${masukByCondition.RUSAK}`
  }

  if (transaksiData.totalKeluar > 0) {
    notes += ` Keluar: ${transaksiData.totalKeluar}`
  }

  notes += `. Estimasi stok saat ini - Baik: ${baik}`
  if (rusak > 0) {
    notes += `, Rusak: ${rusak}`
  }
  if (expire > 0) {
    notes += `, Expire: ${expire}`
  }

  // Add quality indicator
  const totalStok = baik + rusak + expire
  if (totalStok > 0) {
    const qualityPercentage = (baik / totalStok) * 100
    if (qualityPercentage >= 95) {
      notes += ' (Kualitas: Sangat Baik)'
    } else if (qualityPercentage >= 85) {
      notes += ' (Kualitas: Baik)'
    } else if (qualityPercentage >= 70) {
      notes += ' (Kualitas: Perlu Perhatian)'
    } else {
      notes += ' (Kualitas: Buruk)'
    }
  }

  const latestTransaction = [...transaksiData.masukData, ...transaksiData.keluarData]
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())[0]

  if (latestTransaction) {
    notes += `. Update terakhir: ${new Date(latestTransaction.tanggal).toLocaleDateString('id-ID')}`
  }

  return notes
}

// Legacy functions for backward compatibility
function calculateRealisticBreakdown(barang: any, stokSistem: number, gudangId: string): { baik: number; rusak: number; expire: number } {
  if (stokSistem === 0) return { baik: 0, rusak: 0, expire: 0 }

  // Base percentages
  let persentaseBaik = 0.95
  let persentaseRusak = 0.03
  let persentaseExpire = 0.02

  // Adjust based on barang type
  const nama = barang.nama.toLowerCase()

  if (nama.includes('cable') || nama.includes('kabel')) {
    // Cables rarely expire, less damage
    persentaseBaik = 0.98
    persentaseRusak = 0.02
    persentaseExpire = 0
  } else if (nama.includes('battery') || nama.includes('baterai')) {
    // Batteries more likely to expire
    persentaseBaik = 0.85
    persentaseRusak = 0.05
    persentaseExpire = 0.10
  } else if (nama.includes('router') || nama.includes('modem') || nama.includes('ont')) {
    // Electronic devices have moderate damage risk
    persentaseBaik = 0.93
    persentaseRusak = 0.05
    persentaseExpire = 0.02
  } else if (nama.includes('connector') || nama.includes('pigtail') || nama.includes('adaptor')) {
    // Small accessories have lower damage
    persentaseBaik = 0.96
    persentaseRusak = 0.03
    persentaseExpire = 0.01
  }

  // Adjust based on item age (days since created)
  const daysOld = Math.floor((Date.now() - new Date(barang.createdAt).getTime()) / (1000 * 60 * 60 * 24))
  if (daysOld > 365) {
    // Items older than 1 year have higher chance of damage/expire
    persentaseBaik -= 0.05
    persentaseRusak += 0.03
    persentaseExpire += 0.02
  }

  // Adjust based on stock quantity (higher quantity = higher damage probability)
  if (stokSistem > 100) {
    persentaseBaik -= 0.02
    persentaseRusak += 0.02
  }

  // Calculate final numbers
  let baik = Math.floor(stokSistem * persentaseBaik)
  let rusak = Math.floor(stokSistem * persentaseRusak)
  let expire = Math.floor(stokSistem * persentaseExpire)

  // Ensure totals match
  const total = baik + rusak + expire
  if (total !== stokSistem) {
    baik = stokSistem - rusak - expire
  }

  return { baik, rusak, expire }
}

function getDefaultLocation(barang: any): string {
  const nama = barang.nama.toLowerCase()

  if (nama.includes('router') || nama.includes('modem')) return 'Rak Elektronik'
  if (nama.includes('cable') || nama.includes('kabel')) return 'Rak Kabel'
  if (nama.includes('ont') || nama.includes('stp')) return 'Rak Perangkat FTTH'
  if (nama.includes('battery') || nama.includes('psu')) return 'Rak Power Supply'
  if (nama.includes('connector') || nama.includes('adaptor')) return 'Rak Aksesoris'

  return 'Rak Umum'
}

function generateRakNumber(barang: any, gudangKode: string): string {
  const nama = barang.nama.toLowerCase()
  const kodeBarang = barang.kode.toUpperCase()

  // Generate logical rack numbers based on item type
  if (nama.includes('router') || nama.includes('modem')) return `${gudangKode}-E-01`
  if (nama.includes('cable') || nama.includes('kabel')) return `${gudangKode}-C-01`
  if (nama.includes('ont')) return `${gudangKode}-F-01`
  if (nama.includes('connector')) return `${gudangKode}-A-01`

  // Generate based on barang kode
  const rackLetter = kodeBarang.charAt(0)
  const rackNumber = kodeBarang.slice(-2).padStart(2, '0')
  return `${gudangKode}-${rackLetter}-${rackNumber}`
}

function generateBoxNumber(barang: any, rak: string): string {
  return `${rak}-B-001`
}

function generatePIC(barang: any): string {
  const nama = barang.nama.toLowerCase()

  if (nama.includes('router') || nama.includes('modem')) return 'Tim Jaringan'
  if (nama.includes('cable') || nama.includes('kabel')) return 'Tim Instalasi'
  if (nama.includes('ont') || nama.includes('stp')) return 'Teknisi FTTH'
  if (nama.includes('battery')) return 'Tim Power'

  return 'Gudang'
}

function generateEnvironmentalRequirements(barang: any): { suhu?: number; kelembaban?: number } {
  const nama = barang.nama.toLowerCase()

  if (nama.includes('battery')) {
    return { suhu: 25, kelembaban: 45 }
  }
  if (nama.includes('router') || nama.includes('modem')) {
    return { suhu: 22, kelembaban: 50 }
  }
  if (nama.includes('ont')) {
    return { suhu: 20, kelembaban: 40 }
  }

  return {}
}

function calculateExpiryDate(barang: any, stokSistem: number): Date | undefined {
  const nama = barang.nama.toLowerCase()

  if (stokSistem === 0) return undefined
  if (!nama.includes('battery') && !nama.includes('baterai')) return undefined

  // Set expiry 2 years from now for batteries
  const expiryDate = new Date()
  expiryDate.setFullYear(expiryDate.getFullYear() + 2)
  return expiryDate
}

function generateBatchNumber(barang: any): string {
  const tahun = new Date().getFullYear()
  const bulan = String(new Date().getMonth() + 1).padStart(2, '0')
  const kodeBarang = barang.kode.toUpperCase().slice(-3)

  return `${tahun}${bulan}-${kodeBarang}-001`
}

function generateDetailedNotes(barang: any, stokSistem: number, baik: number, rusak: number, expire: number): string {
  if (stokSistem === 0) return 'Stok habis'

  let notes = `Stok sistem: ${stokSistem}, Kondisi aktual: ${baik} baik`
  if (rusak > 0) notes += `, ${rusak} rusak`
  if (expire > 0) notes += `, ${expire} expire`

  // Add specific notes based on conditions
  if (rusak > 0) {
    notes += '. Perlu penggantian item rusak.'
  }
  if (expire > 0) {
    notes += '. Item expired harus dikeluarkan.'
  }
  if (baik === stokSistem && stokSistem > 0) {
    notes += '. Kondisi normal.'
  }
  if (stokSistem < 10) {
    notes += ' Stok rendah, perlu restock.'
  }

  return notes
}