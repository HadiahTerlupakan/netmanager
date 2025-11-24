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
    console.log(`[GET Tagihan Pelanggan] Pelanggan ID: ${pelangganId}, Jumlah tagihan awal: ${tagihans.length}`)
    
    // Ambil data pelanggan untuk cek kondisi generate tagihan
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      include: { hargaPaket: true },
    })
    
    if (pelanggan && pelanggan.hargaPaket) {
      const jatuhTempo = new Date(pelanggan.jatuhTempo)
      const periodeBulan = sekarang.getMonth() + 1
      const periodeTahun = sekarang.getFullYear()
      
      console.log(`[GET Tagihan Pelanggan] Pelanggan: ${pelanggan.nama} (${pelanggan.idPelanggan})`)
      console.log(`[GET Tagihan Pelanggan] Jatuh Tempo: ${jatuhTempo.toISOString()}, Sekarang: ${sekarang.toISOString()}`)
      console.log(`[GET Tagihan Pelanggan] Periode saat ini: ${periodeBulan}/${periodeTahun}`)
      
      // Cek apakah tagihan untuk periode saat ini sudah ada
      const existingTagihan = await tagihanRepo.findByPelangganAndPeriode(
        pelangganId,
        periodeBulan,
        periodeTahun
      )
      
      console.log(`[GET Tagihan Pelanggan] Tagihan untuk periode ${periodeBulan}/${periodeTahun} sudah ada: ${existingTagihan ? 'Ya' : 'Tidak'}`)
      
      // Jika tidak ada tagihan untuk periode saat ini, cek apakah perlu generate
      if (!existingTagihan) {
        const paket = pelanggan.hargaPaket
        let perluGenerate = false
        
        if (paket.durasiUnit === 'BULAN' || paket.durasiUnit === 'TAHUN') {
          const jatuhTempoBulan = jatuhTempo.getMonth() + 1
          const jatuhTempoTahun = jatuhTempo.getFullYear()
          
          console.log(`[GET Tagihan Pelanggan] Jatuh tempo pelanggan: ${jatuhTempoBulan}/${jatuhTempoTahun}`)
          
          // Generate jika:
          // 1. Jatuh tempo sudah lewat, ATAU
          // 2. Jatuh tempo di bulan periode ini, ATAU
          // 3. Tidak ada tagihan sama sekali (untuk memastikan tagihan muncul)
          if (jatuhTempo <= sekarang || 
              (jatuhTempoBulan === periodeBulan && jatuhTempoTahun === periodeTahun) ||
              tagihans.length === 0) {
            perluGenerate = true
            console.log(`[GET Tagihan Pelanggan] Kondisi generate terpenuhi: jatuh tempo lewat atau di bulan periode atau tidak ada tagihan`)
          }
        } else {
          // Untuk paket harian/jam-jaman, generate jika jatuh tempo sudah lewat
          if (jatuhTempo <= sekarang) {
            perluGenerate = true
          }
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
        } else {
          console.log(`[GET Tagihan Pelanggan] Tidak perlu generate tagihan (kondisi tidak terpenuhi)`)
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

