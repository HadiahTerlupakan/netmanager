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
    let tagihans = await tagihanRepo.findByPelangganId(pelangganId)
    const sekarang = new Date()
    
    // Debug: Log jumlah tagihan yang ditemukan
    console.log(`[GET Tagihan Pelanggan] Pelanggan ID: ${pelangganId}, Jumlah tagihan: ${tagihans.length}`)
    
    // Jika tidak ada tagihan, cek apakah pelanggan sudah jatuh tempo dan perlu generate tagihan
    if (tagihans.length === 0) {
      const pelanggan = await prisma.pelanggan.findUnique({
        where: { id: pelangganId },
        include: { hargaPaket: true },
      })
      
      if (pelanggan && pelanggan.hargaPaket) {
        const jatuhTempo = new Date(pelanggan.jatuhTempo)
        console.log(`[GET Tagihan Pelanggan] Pelanggan ${pelanggan.nama} (${pelanggan.idPelanggan}), Jatuh Tempo: ${jatuhTempo.toISOString()}, Sekarang: ${sekarang.toISOString()}`)
        
        // Jika jatuh tempo sudah lewat, generate tagihan untuk periode saat ini
        if (jatuhTempo <= sekarang) {
          console.log(`[GET Tagihan Pelanggan] Jatuh tempo sudah lewat, generate tagihan...`)
          try {
            const { generateTagihan } = await import('@/lib/services/tagihan-service')
            // Gunakan periode saat ini, bukan periode jatuh tempo
            const periodeBulan = sekarang.getMonth() + 1
            const periodeTahun = sekarang.getFullYear()
            
            // Cek apakah tagihan untuk periode ini sudah ada
            const existingTagihan = await tagihanRepo.findByPelangganAndPeriode(
              pelangganId,
              periodeBulan,
              periodeTahun
            )
            
            if (!existingTagihan) {
              await generateTagihan(pelangganId, periodeBulan, periodeTahun)
              console.log(`[GET Tagihan Pelanggan] Tagihan berhasil di-generate untuk periode ${periodeBulan}/${periodeTahun}`)
            } else {
              console.log(`[GET Tagihan Pelanggan] Tagihan untuk periode ${periodeBulan}/${periodeTahun} sudah ada`)
            }
            
            // Fetch ulang tagihan setelah generate
            tagihans = await tagihanRepo.findByPelangganId(pelangganId)
          } catch (error: any) {
            console.error(`[GET Tagihan Pelanggan] Error generate tagihan:`, error.message)
            // Jika tagihan sudah ada, fetch ulang
            tagihans = await tagihanRepo.findByPelangganId(pelangganId)
          }
        }
      }
    }

    // Update status tagihan yang sudah jatuh tempo menjadi TERLAMBAT
    for (const tagihan of tagihans) {
      if (tagihan.status === TagihanStatus.BELUM_LUNAS) {
        const jatuhTempo = new Date(tagihan.jatuhTempo)
        if (jatuhTempo < sekarang) {
          // Tagihan sudah jatuh tempo, update status menjadi TERLAMBAT
          await tagihanRepo.update(tagihan.id, {
            status: TagihanStatus.TERLAMBAT,
          })
        }
      }
    }

    // Recalculate tagihan yang belum lunas untuk memastikan perhitungan sesuai
    for (const tagihan of tagihans) {
      if (tagihan.status !== TagihanStatus.LUNAS) {
        try {
          await recalculateTagihan(tagihan.id)
        } catch (error: any) {
          // Jika recalculate gagal, lanjutkan ke tagihan berikutnya
          console.error(`Error recalculating tagihan ${tagihan.id}:`, error)
        }
      }
    }

    // Fetch ulang tagihan setelah update dan recalculate
    const updatedTagihans = await tagihanRepo.findByPelangganId(pelangganId)

    return NextResponse.json(updatedTagihans)
  } catch (error: any) {
    console.error('Error fetching tagihan pelanggan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

