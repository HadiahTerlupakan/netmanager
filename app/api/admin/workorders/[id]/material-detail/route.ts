import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET - Get material detail by updateId
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const updateId = req.nextUrl.searchParams.get('updateId')

        if (!updateId) {
            return NextResponse.json({ error: 'updateId is required' }, { status: 400 })
        }

        // Get the work order update with related data
        const update = await prisma.workOrderUpdates.findUnique({
            where: { id: updateId },
            include: {
                user: {
                    select: { id: true, name: true, email: true }
                },
                workOrders: {
                    select: { workOrderNumber: true, usedMaterials: true }
                }
            }
        })

        if (!update) {
            return NextResponse.json({ error: 'Update not found' }, { status: 404 })
        }

        if (update.workOrderId !== id) {
            return NextResponse.json({ error: 'Update does not belong to this work order' }, { status: 400 })
        }

        // Parse the message to extract material info
        const message = update.message || ''
        const isPickup = update.updateType === 'MATERIAL_PICKUP'
        
        // Try to find the material in usedMaterials closest to this update time
        const usedMaterials = (update.workOrders?.usedMaterials as any[]) || []
        
        // Extract material name from message
        const materialMatch = message.match(/(?:Mengambil|Mengembalikan) barang: (.+)/)
        const materialInfo = materialMatch ? materialMatch[1] : message
        
        // Parse material details from the message format: "NamaBarang - Kondisi (jumlah satuan)"
        const detailMatch = materialInfo.match(/^(.+?) - (\w+) \((\d+) (.+?)\)/)
        
        let materialDetail: any = null
        
        if (detailMatch) {
            const [, namaBarang, kondisi, jumlah, satuan] = detailMatch
            
            // Try to find matching material in usedMaterials
            const matchingMaterial = usedMaterials.find((m: any) => 
                m.nama?.toLowerCase().includes(namaBarang.toLowerCase().trim()) ||
                namaBarang.toLowerCase().trim().includes(m.nama?.toLowerCase())
            )
            
            if (matchingMaterial) {
                // Fetch full barang and gudang info
                const barang = await prisma.barang.findUnique({
                    where: { id: matchingMaterial.barangId },
                    select: { id: true, kode: true, nama: true, satuan: true }
                })
                
                const gudang = matchingMaterial.gudangId ? await prisma.gudang.findUnique({
                    where: { id: matchingMaterial.gudangId },
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

        return NextResponse.json(materialDetail)
    } catch (error) {
        console.error('Error fetching material detail:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
