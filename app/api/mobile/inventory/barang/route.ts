import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMobileToken } from '@/lib/mobile-auth'

// GET - Get barang list for mobile (with stock from a gudang)
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const decoded = await verifyMobileToken(token)

        if (!decoded || !decoded.id) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const userId = decoded.id as string

        const { searchParams } = new URL(req.url)
        const gudangId = searchParams.get('gudangId')

        if (!gudangId) {
            return NextResponse.json({ error: 'gudangId required' }, { status: 400 })
        }

        // Fetch user to check permissions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { 
                role: { include: { permission: true } },
                sites: true
            }
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Check for Site-Based Restriction Policy
        const userPermissions = user.role?.permission.map(p => `${p.resource}:${p.action}`) || []
        const isSiteRestricted = userPermissions.includes('k_barang:site_only')

        let whereClause: any = {
            gudangId
        }

        if (isSiteRestricted) {
            if (!user.sites?.id) {
                // If restricted but no site assigned, return empty
                return NextResponse.json({ barangList: [] })
            }
            // Filter by Gudang that belongs to user's Site (many-to-many relation)
            whereClause.gudang = {
                sites: {
                    some: {
                        id: user.sites?.id
                    }
                }
            }
        }

        // Get barang with stock in the specified gudang using BarangGudang
        const barangGudangs = await prisma.barangGudang.findMany({
            where: whereClause,
            include: {
                barang: {
                    select: {
                        id: true,
                        kode: true,
                        nama: true,
                        satuan: true,
                        isWorkOrderMaterial: true
                    }
                }
            },
            orderBy: {
                barang: { nama: 'asc' }
            }
        })

        const barangList = barangGudangs.map(bg => ({
            id: bg.barang.id,
            kode: bg.barang.kode,
            nama: bg.barang.nama,
            satuan: bg.barang.satuan,
            isWorkOrderMaterial: bg.barang.isWorkOrderMaterial,
            stok: bg.stok,
            stokBaru: bg.stokBaru,
            stokBekas: bg.stokBekas,
            stokRusak: bg.stokRusak
        }))

        return NextResponse.json({ barangList })
    } catch (error) {
        console.error('Error fetching barangs (mobile):', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
