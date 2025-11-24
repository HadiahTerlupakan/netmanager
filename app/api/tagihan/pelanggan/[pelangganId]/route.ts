import { NextRequest, NextResponse } from 'next/server'
import { getTagihanRepository } from '@/lib/repositories'
import { recalculateTagihan } from '@/lib/services/tagihan-service'
import { TagihanStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/tagihan/pelanggan/[pelangganId]
 * List tagihan per pelanggan
 * Otomatis recalculate tagihan yang belum lunas untuk memastikan perhitungan sesuai
 * Otomatis update status tagihan yang sudah jatuh tempo menjadi TERLAMBAT
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pelangganId: string }> },
) {
  try {
    const { pelangganId } = await params
    const tagihanRepo = getTagihanRepository()
    
    // Ambil data pelanggan terlebih dahulu untuk cek kondisi generate tagihan
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      include: { hargaPaket: true },
    })
    
    if (!pelanggan) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 })
    }
    
    let tagihans = await tagihanRepo.findByPelangganId(pelangganId)
    const sekarang = new Date()
    
    // Debug: Log jumlah tagihan yang ditemukan
    console.log(`[GET Tagihan Pelanggan] Pelanggan ID: ${pelangganId}, Jumlah tagihan awal: ${tagihans.length}`)
    
    if (pelanggan.hargaPaket) {
      const jatuhTempoPelanggan = new Date(pelanggan.jatuhTempo)
      const periodeBulan = sekarang.getMonth() + 1
      const periodeTahun = sekarang.getFullYear()

      console.log(`[GET Tagihan Pelanggan] Pelanggan: ${pelanggan.nama} (${pelanggan.idPelanggan})`)
      console.log(`[GET Tagihan Pelanggan] Jatuh Tempo Pelanggan: ${jatuhTempoPelanggan.toISOString()}, Sekarang: ${sekarang.toISOString()}`)
      console.log(`[GET Tagihan Pelanggan] Periode saat ini: ${periodeBulan}/${periodeTahun}`)

      // Cek apakah ada tagihan yang belum lunas (prioritaskan tagihan existing)
      const adaTagihanBelumLunas = tagihans.some(t => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT')

      console.log(`[GET Tagihan Pelanggan] Ada tagihan belum lunas: ${adaTagihanBelumLunas}`)

      // HANYA generate tagihan untuk periode saat ini jika:
      // 1. Tidak ada tagihan sama sekali, ATAU
      // 2. Tidak ada tagihan yang belum lunas DAN jatuh tempo pelanggan sudah lewat
      let perluGenerate = false

      if (tagihans.length === 0) {
        perluGenerate = true
        console.log(`[GET Tagihan Pelanggan] Perlu generate: tidak ada tagihan sama sekali`)
      } else if (!adaTagihanBelumLunas && jatuhTempoPelanggan <= sekarang) {
        // Cek apakah tagihan untuk periode saat ini sudah ada
        const existingTagihan = await tagihanRepo.findByPelangganAndPeriode(
          pelangganId,
          periodeBulan,
          periodeTahun
        )

        if (!existingTagihan) {
          perluGenerate = true
          console.log(`[GET Tagihan Pelanggan] Perlu generate: tidak ada tagihan belum lunas dan jatuh tempo pelanggan sudah lewat, belum ada tagihan periode ${periodeBulan}/${periodeTahun}`)
        } else {
          console.log(`[GET Tagihan Pelanggan] Tidak perlu generate: tagihan periode ${periodeBulan}/${periodeTahun} sudah ada`)
        }
      } else {
        console.log(`[GET Tagihan Pelanggan] Tidak perlu generate: ada tagihan belum lunas atau jatuh tempo belum lewat`)
      }

      if (perluGenerate) {
        console.log(`[GET Tagihan Pelanggan] Generate tagihan untuk periode ${periodeBulan}/${periodeTahun}...`)
        try {
          const { generateTagihan } = await import('@/lib/services/tagihan-service')
          await generateTagihan(pelangganId, periodeBulan, periodeTahun)
          console.log(`[GET Tagihan Pelanggan] Tagihan berhasil di-generate untuk periode ${periodeBulan}/${periodeTahun}`)

          // Fetch ulang tagihan setelah generate
          tagihans = await tagihanRepo.findByPelangganId(pelangganId)
          console.log(`[GET Tagihan Pelanggan] Jumlah tagihan setelah generate: ${tagihans.length}`)
        } catch (error: any) {
          console.error(`[GET Tagihan Pelanggan] Error generate tagihan:`, error.message)
          console.error(`[GET Tagihan Pelanggan] Error stack:`, error.stack)
          // Fetch ulang tagihan meskipun error (mungkin tagihan sudah ada)
          tagihans = await tagihanRepo.findByPelangganId(pelangganId)
        }
      }
    }

    // Update status tagihan yang sudah jatuh tempo menjadi TERLAMBAT
    // Lakukan ini sebelum recalculate untuk memastikan status yang benar
    for (const tagihan of tagihans) {
      if (tagihan.status === TagihanStatus.BELUM_LUNAS) {
        const jatuhTempo = new Date(tagihan.jatuhTempo)
        if (jatuhTempo < sekarang) {
          // Tagihan sudah jatuh tempo, update status menjadi TERLAMBAT
          await tagihanRepo.update(tagihan.id, {
            status: TagihanStatus.TERLAMBAT,
          })
          console.log(`[GET Tagihan Pelanggan] Tagihan ${tagihan.id} status updated to TERLAMBAT`)
        }
      }
    }

    // Recalculate tagihan yang belum lunas untuk memastikan perhitungan sesuai
    // Lakukan ini setelah update status untuk memastikan perhitungan yang benar
    for (const tagihan of tagihans) {
      if (tagihan.status !== TagihanStatus.LUNAS) {
        try {
          await recalculateTagihan(tagihan.id)
          console.log(`[GET Tagihan Pelanggan] Tagihan ${tagihan.id} recalculated`)
        } catch (error: any) {
          // Jika recalculate gagal, lanjutkan ke tagihan berikutnya
          console.error(`Error recalculating tagihan ${tagihan.id}:`, error)
        }
      }
    }

    // Fetch ulang tagihan setelah update dan recalculate
    const updatedTagihans = await tagihanRepo.findByPelangganId(pelangganId)
    console.log(`[GET Tagihan Pelanggan] Final tagihan count: ${updatedTagihans.length}`)

    return NextResponse.json(updatedTagihans, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error fetching tagihan pelanggan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

