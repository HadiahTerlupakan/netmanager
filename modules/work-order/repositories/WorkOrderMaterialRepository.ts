import { prisma as defaultPrisma } from '@/lib/prisma'

type PrismaInstance = typeof defaultPrisma

export class WorkOrderMaterialRepository {
    constructor(private prisma: PrismaInstance = defaultPrisma) {}

    async addMaterialWithStockDeduction(
        workOrderId: string,
        barangId: string,
        quantity: number,
        actorId: string,
        notes?: string | null,
        preferredGudangId?: string
    ) {
        return this.prisma.$transaction(async (tx) => {
            const workOrder = await tx.workOrders.findUnique({ where: { id: workOrderId } })
            if (!workOrder) {
                throw new Error('Work order tidak ditemukan')
            }

            const barang = await tx.barang.findUnique({
                where: { id: barangId },
                include: {
                    barangGudang: {
                        where: {
                            stok: { gte: quantity },
                            ...(preferredGudangId ? { gudangId: preferredGudangId } : {})
                        },
                        orderBy: { stok: 'desc' },
                        take: 1
                    }
                }
            })

            if (!barang) {
                throw new Error('Barang tidak ditemukan')
            }

            const gudangSource = barang.barangGudang[0]
            if (!gudangSource || gudangSource.stok < quantity) {
                throw new Error(`Stok tidak mencukupi di gudang yang ditentukan. Tersedia: ${gudangSource?.stok || 0}`)
            }

            if (Math.floor(quantity) !== quantity) {
                throw new Error('Jumlah material harus angka bulat (tidak boleh desimal)')
            }

            await tx.barangGudang.update({
                where: {
                    barangId_gudangId: {
                        barangId,
                        gudangId: gudangSource.gudangId
                    }
                },
                data: {
                    stok: { decrement: quantity },
                    stokBaru: { decrement: quantity }
                }
            })

            const material = await tx.workOrderMaterial.create({
                data: {
                    workOrderId,
                    barangId,
                    quantity,
                    notes: notes ?? null,
                    satuan: barang.satuan
                },
                include: {
                    barang: true
                }
            })

            await tx.barangKeluar.create({
                data: {
                    id: crypto.randomUUID(),
                    barangId,
                    gudangId: gudangSource.gudangId,
                    jumlah: quantity,
                    tanggal: new Date(),
                    kondisi: 'BARU',
                    keterangan: `Used in Work Order #${workOrder.workOrderNumber}`,
                    tujuanPenggunaan: 'WORK_ORDER',
                    userId: actorId,
                }
            })

            return material
        })
    }
}
