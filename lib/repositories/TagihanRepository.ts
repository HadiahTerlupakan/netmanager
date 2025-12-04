import { PrismaClient, TagihanStatus } from '@prisma/client'
import type {
  ITagihanRepository,
  TagihanCreateData,
  TagihanUpdateData,
  TagihanPublic,
  TagihanWithPelanggan,
} from './ITagihanRepository'
import { prisma } from '@/lib/prisma'

export class TagihanRepository implements ITagihanRepository {
  constructor(private client: PrismaClient = prisma) { }

  async findAll(): Promise<TagihanPublic[]> {
    const tagihans = await this.client.tagihan.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        pelangganId: true,
        noTagihan: true,
        periodeBulan: true,
        periodeTahun: true,
        subtotal: true,
        diskon: true,
        ppn: true,
        biayaInstalasi: true,
        biayaSewaPerangkat: true,
        biayaLainnya: true,
        total: true,
        status: true,
        jatuhTempo: true,
        tanggalBayar: true,
        metodePembayaran: true,
        catatan: true,
        createdAt: true,
        updatedAt: true,
        pelanggan: {
          select: {
            id: true,
            idPelanggan: true,
            nama: true,
            tipe: true,
          },
        },
      },
    })
    return tagihans as any
  }

  async findById(id: string): Promise<TagihanWithPelanggan | null> {
    const tagihan = await this.client.tagihan.findUnique({
      where: { id },
      select: {
        id: true,
        pelangganId: true,
        noTagihan: true,
        periodeBulan: true,
        periodeTahun: true,
        subtotal: true,
        diskon: true,
        ppn: true,
        biayaInstalasi: true,
        biayaSewaPerangkat: true,
        biayaLainnya: true,
        total: true,
        status: true,
        jatuhTempo: true,
        tanggalBayar: true,
        metodePembayaran: true,
        catatan: true,
        createdAt: true,
        updatedAt: true,
        pelanggan: {
          select: {
            id: true,
            idPelanggan: true,
            nama: true,
            email: true,
            alamat: true,
            noTelp: true,
            hargaPaket: {
              select: {
                name: true,
                harga: true,
              },
            },
          },
        },
      },
    })
    return tagihan as TagihanWithPelanggan | null
  }

  async findByNoTagihan(noTagihan: string): Promise<TagihanPublic | null> {
    const tagihan = await this.client.tagihan.findUnique({
      where: { noTagihan },
      select: {
        id: true,
        pelangganId: true,
        noTagihan: true,
        periodeBulan: true,
        periodeTahun: true,
        subtotal: true,
        diskon: true,
        ppn: true,
        biayaInstalasi: true,
        biayaSewaPerangkat: true,
        biayaLainnya: true,
        total: true,
        status: true,
        jatuhTempo: true,
        tanggalBayar: true,
        metodePembayaran: true,
        catatan: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return tagihan
  }

  async findByPelangganId(pelangganId: string): Promise<TagihanPublic[]> {
    const tagihans = await this.client.tagihan.findMany({
      where: { pelangganId },
      orderBy: [{ periodeTahun: 'desc' }, { periodeBulan: 'desc' }],
      select: {
        id: true,
        pelangganId: true,
        noTagihan: true,
        periodeBulan: true,
        periodeTahun: true,
        subtotal: true,
        diskon: true,
        ppn: true,
        biayaInstalasi: true,
        biayaSewaPerangkat: true,
        biayaLainnya: true,
        total: true,
        status: true,
        jatuhTempo: true,
        tanggalBayar: true,
        metodePembayaran: true,
        catatan: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return tagihans
  }

  async findByPelangganIdWithPelanggan(pelangganId: string): Promise<TagihanWithPelanggan[]> {
    const tagihans = await this.client.tagihan.findMany({
      where: { pelangganId },
      orderBy: [{ periodeTahun: 'desc' }, { periodeBulan: 'desc' }],
      select: {
        id: true,
        pelangganId: true,
        noTagihan: true,
        periodeBulan: true,
        periodeTahun: true,
        subtotal: true,
        diskon: true,
        ppn: true,
        biayaInstalasi: true,
        biayaSewaPerangkat: true,
        biayaLainnya: true,
        total: true,
        status: true,
        jatuhTempo: true,
        tanggalBayar: true,
        metodePembayaran: true,
        catatan: true,
        createdAt: true,
        updatedAt: true,
        pelanggan: {
          select: {
            id: true,
            idPelanggan: true,
            nama: true,
            email: true,
          },
        },
      },
    })
    return tagihans as TagihanWithPelanggan[]
  }

  async findByStatus(status: TagihanStatus): Promise<TagihanPublic[]> {
    const tagihans = await this.client.tagihan.findMany({
      where: { status },
      orderBy: { jatuhTempo: 'asc' },
      select: {
        id: true,
        pelangganId: true,
        noTagihan: true,
        periodeBulan: true,
        periodeTahun: true,
        subtotal: true,
        diskon: true,
        ppn: true,
        biayaInstalasi: true,
        biayaSewaPerangkat: true,
        biayaLainnya: true,
        total: true,
        status: true,
        jatuhTempo: true,
        tanggalBayar: true,
        metodePembayaran: true,
        catatan: true,
        createdAt: true,
        updatedAt: true,
        pelanggan: {
          select: {
            id: true,
            idPelanggan: true,
            nama: true,
            tipe: true,
          },
        },
      },
    })
    return tagihans as any
  }

  async findByPeriode(periodeBulan: number, periodeTahun: number): Promise<TagihanPublic[]> {
    const tagihans = await this.client.tagihan.findMany({
      where: {
        periodeBulan,
        periodeTahun,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        pelangganId: true,
        noTagihan: true,
        periodeBulan: true,
        periodeTahun: true,
        subtotal: true,
        diskon: true,
        ppn: true,
        biayaInstalasi: true,
        biayaSewaPerangkat: true,
        biayaLainnya: true,
        total: true,
        status: true,
        jatuhTempo: true,
        tanggalBayar: true,
        metodePembayaran: true,
        catatan: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return tagihans
  }

  async findByPelangganAndPeriode(
    pelangganId: string,
    periodeBulan: number,
    periodeTahun: number,
  ): Promise<TagihanPublic | null> {
    const tagihan = await this.client.tagihan.findUnique({
      where: {
        pelangganId_periodeBulan_periodeTahun: {
          pelangganId,
          periodeBulan,
          periodeTahun,
        },
      },
      select: {
        id: true,
        pelangganId: true,
        noTagihan: true,
        periodeBulan: true,
        periodeTahun: true,
        subtotal: true,
        diskon: true,
        ppn: true,
        biayaInstalasi: true,
        biayaSewaPerangkat: true,
        biayaLainnya: true,
        total: true,
        status: true,
        jatuhTempo: true,
        tanggalBayar: true,
        metodePembayaran: true,
        catatan: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return tagihan
  }

  async create(data: TagihanCreateData): Promise<{ id: string }> {
    const tagihan = await this.client.tagihan.create({
      data,
      select: { id: true, ppn: true, periodeBulan: true, periodeTahun: true, noTagihan: true, subtotal: true },
    })

    // Auto-create tax record if PPN exists
    if (tagihan.ppn > 0) {
      try {
        await this.client.taxRecord.create({
          data: {
            taxType: 'PPN_OUT',
            taxPeriod: tagihan.periodeBulan,
            taxYear: tagihan.periodeTahun,
            taxableAmount: BigInt(tagihan.subtotal), // DPP adalah subtotal
            taxAmount: BigInt(tagihan.ppn),
            taxRate: 0.11, // 11% PPN
            reference: tagihan.noTagihan,
            relatedEntityType: 'TAGIHAN',
            relatedEntityId: tagihan.id,
            status: 'DRAFT',
            notes: `Auto-created from Tagihan ${tagihan.noTagihan}`,
          },
        })
        console.log(`[Tax Integration] Created PPN_OUT record for tagihan ${tagihan.noTagihan}`)
      } catch (error) {
        console.error('[Tax Integration] Failed to create tax record:', error)
        // Don't fail the tagihan creation if tax record creation fails
      }
    }

    return { id: tagihan.id }
  }

  async update(id: string, data: TagihanUpdateData): Promise<void> {
    // Get current tagihan to check PPN changes
    const currentTagihan = await this.client.tagihan.findUnique({
      where: { id },
      select: { ppn: true, periodeBulan: true, periodeTahun: true, noTagihan: true, subtotal: true },
    })

    await this.client.tagihan.update({
      where: { id },
      data,
    })

    // Update tax record if PPN changed
    if (currentTagihan && data.ppn !== undefined && data.ppn !== currentTagihan.ppn) {
      try {
        // Find existing tax record
        const existingTaxRecord = await this.client.taxRecord.findFirst({
          where: {
            relatedEntityType: 'TAGIHAN',
            relatedEntityId: id,
            taxType: 'PPN_OUT',
          },
        })

        const newSubtotal = data.subtotal ?? currentTagihan.subtotal

        if (existingTaxRecord) {
          // Update existing tax record
          await this.client.taxRecord.update({
            where: { id: existingTaxRecord.id },
            data: {
              taxableAmount: BigInt(newSubtotal),
              taxAmount: BigInt(data.ppn),
              taxRate: 0.11,
              notes: `Updated from Tagihan ${currentTagihan.noTagihan}`,
            },
          })
          console.log(`[Tax Integration] Updated PPN_OUT record for tagihan ${currentTagihan.noTagihan}`)
        } else if (data.ppn > 0) {
          // Create new tax record if none exists
          await this.client.taxRecord.create({
            data: {
              taxType: 'PPN_OUT',
              taxPeriod: currentTagihan.periodeBulan,
              taxYear: currentTagihan.periodeTahun,
              taxableAmount: BigInt(newSubtotal),
              taxAmount: BigInt(data.ppn),
              taxRate: 0.11,
              reference: currentTagihan.noTagihan,
              relatedEntityType: 'TAGIHAN',
              relatedEntityId: id,
              status: 'DRAFT',
              notes: `Auto-created from Tagihan ${currentTagihan.noTagihan}`,
            },
          })
          console.log(`[Tax Integration] Created PPN_OUT record for tagihan ${currentTagihan.noTagihan}`)
        }
      } catch (error) {
        console.error('[Tax Integration] Failed to update tax record:', error)
        // Don't fail the tagihan update if tax record update fails
      }
    }
  }

  async delete(id: string): Promise<void> {
    await this.client.tagihan.delete({
      where: { id },
    })
  }

  async count(): Promise<number> {
    return await this.client.tagihan.count()
  }

  async countByStatus(status: TagihanStatus): Promise<number> {
    return await this.client.tagihan.count({
      where: { status },
    })
  }

  async countByPelangganId(pelangganId: string): Promise<number> {
    return await this.client.tagihan.count({
      where: { pelangganId },
    })
  }

  async countByPeriode(periodeBulan: number, periodeTahun: number): Promise<number> {
    return await this.client.tagihan.count({
      where: {
        periodeBulan,
        periodeTahun,
      },
    })
  }

  async countByPeriodeAndTanggal(periodeBulan: number, periodeTahun: number, tanggal: Date): Promise<number> {
    // Hitung tagihan yang dibuat pada tanggal yang sama (untuk tagihan harian)
    const startOfDay = new Date(tanggal)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(tanggal)
    endOfDay.setHours(23, 59, 59, 999)

    return await this.client.tagihan.count({
      where: {
        periodeBulan,
        periodeTahun,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    })
  }

  async findTerlambat(): Promise<TagihanPublic[]> {
    const now = new Date()
    const tagihans = await this.client.tagihan.findMany({
      where: {
        status: {
          in: [TagihanStatus.BELUM_LUNAS, TagihanStatus.TERLAMBAT],
        },
        jatuhTempo: {
          lt: now,
        },
      },
      orderBy: { jatuhTempo: 'asc' },
      select: {
        id: true,
        pelangganId: true,
        noTagihan: true,
        periodeBulan: true,
        periodeTahun: true,
        subtotal: true,
        diskon: true,
        ppn: true,
        biayaInstalasi: true,
        biayaSewaPerangkat: true,
        biayaLainnya: true,
        total: true,
        status: true,
        jatuhTempo: true,
        tanggalBayar: true,
        metodePembayaran: true,
        catatan: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return tagihans
  }

  async aggregateTotalByStatus(status: TagihanStatus): Promise<number> {
    const result = await this.client.tagihan.aggregate({
      where: { status },
      _sum: {
        total: true,
      },
    })
    return result._sum.total || 0
  }

  async aggregateTotalByStatusAndPeriod(status: string, month?: number, year?: number): Promise<number> {
    try {
      if (!('tagihan' in this.client)) {
        return 0
      }
      
      const where: any = { status }
      
      if (month !== undefined && year !== undefined) {
        where.periodeBulan = month
        where.periodeTahun = year
      }
      
      const result = await (this.client as any).tagihan.aggregate({
        where,
        _sum: {
          total: true,
        },
      })
      
      return Number(result._sum.total || 0)
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return 0
      }
      throw error
    }
  }

  async groupByPeriode(): Promise<any[]> {
    const result = await this.client.tagihan.groupBy({
      by: ['periodeBulan', 'periodeTahun', 'status'],
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
    })
    return result
  }

  async groupByCategoryAndPeriod(month?: number, year?: number): Promise<any[]> {
    try {
      if (!('tagihan' in this.client)) {
        return []
      }

      const where: any = {}

      if (month !== undefined && year !== undefined) {
        where.periodeBulan = month
        where.periodeTahun = year
      }

      // Since tagihan doesn't have kategori field, we'll create categories based on billing components
      const tagihanData = await (this.client as any).tagihan.findMany({
        where,
        select: {
          id: true,
          periodeBulan: true,
          periodeTahun: true,
          subtotal: true,
          biayaInstalasi: true,
          biayaSewaPerangkat: true,
          biayaLainnya: true,
          total: true,
          status: true,
        }
      })

      // Group by manually created categories
      const groupedData = tagihanData.reduce((acc: any, tagihan: any) => {
        const key = `${tagihan.periodeBulan}-${tagihan.periodeTahun}`

        if (!acc[key]) {
          acc[key] = {
            periodeBulan: tagihan.periodeBulan,
            periodeTahun: tagihan.periodeTahun,
            langganan: 0,
            instalasi: 0,
            sewaPerangkat: 0,
            lainnya: 0,
            total: 0,
            count: 0,
          }
        }

        acc[key].langganan += tagihan.subtotal
        acc[key].instalasi += tagihan.biayaInstalasi
        acc[key].sewaPerangkat += tagihan.biayaSewaPerangkat
        acc[key].lainnya += tagihan.biayaLainnya
        acc[key].total += tagihan.total
        acc[key].count += 1

        return acc
      }, {})

      // Convert to array format with categories
      const result: any[] = []

      Object.values(groupedData).forEach((data: any) => {
        // Add subscription category
        if (data.langganan > 0) {
          result.push({
            kategori: 'Langganan',
            periodeBulan: data.periodeBulan,
            periodeTahun: data.periodeTahun,
            _sum: {
              total: Number(data.langganan)
            },
            _count: {
              id: data.count
            }
          })
        }

        // Add installation category
        if (data.instalasi > 0) {
          result.push({
            kategori: 'Instalasi',
            periodeBulan: data.periodeBulan,
            periodeTahun: data.periodeTahun,
            _sum: {
              total: Number(data.instalasi)
            },
            _count: {
              id: data.count
            }
          })
        }

        // Add device rental category
        if (data.sewaPerangkat > 0) {
          result.push({
            kategori: 'Sewa Perangkat',
            periodeBulan: data.periodeBulan,
            periodeTahun: data.periodeTahun,
            _sum: {
              total: Number(data.sewaPerangkat)
            },
            _count: {
              id: data.count
            }
          })
        }

        // Add other category
        if (data.lainnya > 0) {
          result.push({
            kategori: 'Lainnya',
            periodeBulan: data.periodeBulan,
            periodeTahun: data.periodeTahun,
            _sum: {
              total: Number(data.lainnya)
            },
            _count: {
              id: data.count
            }
          })
        }
      })

      return result
    } catch (error: any) {
      if (error.message?.includes('Unknown model') || error.message?.includes('does not exist') || error.message?.includes('Cannot read properties')) {
        return []
      }
      throw error
    }
  }
}

