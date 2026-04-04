import { prisma } from '@/modules/database'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'

// GET - Get material detail by updateId
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params
    const updateId = req.nextUrl.searchParams.get('updateId')

    if (!updateId) {
        return apiError('updateId wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    // Get the work order update with related data
    const update = await prisma.workOrderUpdates.findUnique({
        where: { id: updateId },
        include: {
            user: {
                select: { id: true, name: true, email: true }
            },
            workOrders: {
                select: {
                    workOrderNumber: true,
                    usedMaterials: true,
                    returnedMaterials: true // Include returned materials
                }
            }
        }
    })

    if (!update) {
        return ApiErrors.notFound('Update')
    }

    if (update.workOrderId !== id) {
        return apiError('Update tidak ditemukan pada work order ini', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    // Parse the message to extract material info
    const message = update.message || ''
    const isPickup = update.updateType === 'MATERIAL_PICKUP'

    interface MaterialItem {
        id?: string
        nama?: string
        barangId?: string
        gudangId?: string | null
        barang?: {
            id?: string
            nama?: string
        }
        gudang?: {
            id?: string
        }
    }

    let sourceMaterials: MaterialItem[] = []
    if (isPickup) {
        sourceMaterials = (update.workOrders?.usedMaterials as unknown as MaterialItem[]) || []
    } else {
        sourceMaterials = (update.workOrders?.returnedMaterials as unknown as MaterialItem[]) || []
    }

    // Extract material name from message
    const materialMatch = message.match(/(?:Mengambil|Mengembalikan) barang: (.+)/)
    const materialInfo = materialMatch?.[1] ?? message ?? ''

    // Parse material details from the message format: "NamaBarang - Kondisi (jumlah satuan)"
    const detailMatch = materialInfo.match(/^(.+?) - (\w+) \((\d+) (.+?)\)/)

    let materialDetail: Record<string, unknown> | null = null

    if (detailMatch) {
        const namaBarang = detailMatch[1] as string
        const kondisi = detailMatch[2] as string
        const jumlah = detailMatch[3] as string
        const satuan = detailMatch[4] as string

        const matchingMaterial = sourceMaterials.find((m) => {
            const mName = m.nama || m.barang?.nama || ''
            return mName.toLowerCase().trim() === namaBarang.toLowerCase().trim() ||
                   mName.toLowerCase().includes(namaBarang.toLowerCase().trim())
        })

        if (matchingMaterial) {
            const barangId = matchingMaterial.barangId || matchingMaterial.barang?.id
            const gudangId = matchingMaterial.gudangId || matchingMaterial.gudang?.id

            const barang = barangId ? await prisma.barang.findUnique({
                where: { id: barangId },
                select: { id: true, kode: true, nama: true, satuan: true }
            }) : null

            const gudang = gudangId ? await prisma.gudang.findUnique({
                where: { id: gudangId },
                select: { id: true, kode: true, nama: true }
            }) : null

            // Find the actual barangKeluar record if it's a pickup
            if (isPickup && matchingMaterial.id) {
                const keluar = await prisma.barangKeluar.findUnique({
                    where: { id: matchingMaterial.id },
                    include: {
                        barang: { select: { kode: true, nama: true, satuan: true } },
                        gudang: { select: { kode: true, nama: true } },
                        user: { select: { name: true, email: true } }
                    }
                })
                
                if (keluar) {
                    materialDetail = {
                        id: keluar.id,
                        type: 'keluar',
                        tanggal: keluar.tanggal.toISOString(),
                        createdAt: keluar.createdAt.toISOString(),
                        barang: keluar.barang,
                        gudang: keluar.gudang,
                        jumlah: keluar.jumlah,
                        kondisi: keluar.kondisi,
                        keterangan: keluar.keterangan,
                        user: keluar.user || update.user,
                        fotoBukti: keluar.fotoBukti || []
                    }
                }
            }
            
            // Fallback to constructed data
            if (!materialDetail) {
                materialDetail = {
                    id: matchingMaterial.id || updateId,
                    type: isPickup ? 'keluar' : 'masuk',
                    tanggal: update.createdAt.toISOString(),
                    createdAt: update.createdAt.toISOString(),
                    barang: barang || { kode: '-', nama: namaBarang.trim(), satuan: satuan || 'pcs' },
                    gudang: gudang || { kode: '-', nama: 'Gudang' },
                    jumlah: parseInt(jumlah) || 1,
                    kondisi: kondisi || 'BARU',
                    keterangan: `${isPickup ? 'Pengambilan' : 'Pengembalian'} untuk Work Order ${update.workOrders?.workOrderNumber}`,
                    user: update.user,
                    fotoBukti: []
                }
            }
        } else {
            // Construct minimal data from message
            materialDetail = {
                id: updateId,
                type: isPickup ? 'keluar' : 'masuk',
                tanggal: update.createdAt.toISOString(),
                createdAt: update.createdAt.toISOString(),
                barang: { kode: '-', nama: namaBarang.trim(), satuan: satuan || 'pcs' },
                gudang: { kode: '-', nama: 'Gudang' },
                jumlah: parseInt(jumlah) || 1,
                kondisi: kondisi || 'BARU',
                keterangan: message,
                user: update.user,
                fotoBukti: []
            }
        }
    } else {
        // Cannot parse, return basic info
        materialDetail = {
            id: updateId,
            type: isPickup ? 'keluar' : 'masuk',
            tanggal: update.createdAt.toISOString(),
            createdAt: update.createdAt.toISOString(),
            barang: { kode: '-', nama: 'Barang', satuan: 'pcs' },
            gudang: { kode: '-', nama: 'Gudang' },
            jumlah: 1,
            kondisi: 'BARU',
            keterangan: message,
            user: update.user,
            fotoBukti: []
        }
    }

    return apiSuccess(materialDetail)
})
