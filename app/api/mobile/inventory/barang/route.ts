import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { prismaMitra } from '@/lib/prisma-mitra'
import { Prisma } from '@prisma/client'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { apiError, ErrorCodes } from '@/lib/api-response'

// GET - Get barang list for mobile
// Query params:
//   - gudangId: required - Target warehouse
//   - mode: 'masuk' | 'keluar' (default: 'keluar')
//     - masuk: return ALL barang (master data) for receiving new stock
//     - keluar: return only barang with existing stock in the gudang
export async function GET(req: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(req)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const decoded = authResult
        const userId = decoded.id as string
        const tenantId = decoded.tenantId as string

        const { searchParams } = new URL(req.url)
        const gudangId = searchParams.get('gudangId')
        const mode = searchParams.get('mode') || 'keluar' // Default to 'keluar' for backward compatibility

        if (!gudangId && mode !== 'masuk') {
            return apiError('gudangId required', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Fetch user to check permissions
        const user = await prisma.user.findFirst({
            where: { id: userId, tenantId },
            include: {
                role: { include: { permission: true } },
                sites: true
            }
        })

        // Fallback: check Mitra table
        const mitra = !user ? await prismaMitra.mitra.findUnique({
            where: { id: userId },
            select: { id: true, siteId: true }
        }) : null

        if (!user && !mitra) {
            return apiError('User tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
        }

        // Check for Site-Based Restriction Policy (only for User, not Mitra)
        const userPermissions = user?.role?.permission.map(p => `${p.resource}:${p.action}`) || []
        const roleName = (user?.role?.name || '').trim().toUpperCase().replace(/\s+/g, '_');
        const isSuperAdmin = user ? roleName === 'SUPER_ADMIN' : false;
        const isSiteRestricted = user ? (!isSuperAdmin && userPermissions.includes('k_barang:site_only')) : false

        // MODE: MASUK - Return ALL master barang (for receiving new stock)
        if (mode === 'masuk') {
            const barangWhere: Prisma.BarangWhereInput = { tenantId }

            if (isSiteRestricted && user.sites?.id) {
                // Filter barang that have been at least once in the user's site warehouses
                barangWhere.barangGudang = {
                    some: {
                        gudang: {
                            sites: {
                                some: {
                                    id: user.sites.id
                                }
                            }
                        }
                    }
                }
            }

            // Get all barang from master data
            const allBarang = await prisma.barang.findMany({
                where: barangWhere,
                select: {
                    id: true,
                    kode: true,
                    nama: true,
                    satuan: true,
                    isWorkOrderMaterial: true
                },
                orderBy: { nama: 'asc' }
            })

            const barangList = allBarang.map(b => ({
                id: b.id,
                kode: b.kode,
                nama: b.nama,
                satuan: b.satuan,
                isWorkOrderMaterial: b.isWorkOrderMaterial,
                stok: 0,
                stokBaru: 0,
                stokBekas: 0,
                stokRusak: 0
            }))

            return NextResponse.json({ barangList })
        }

        // MODE: KELUAR (default) - Return only barang with existing stock in gudang
        const whereClause: Record<string, unknown> = {
            gudangId,
            tenantId
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
        return apiError('Terjadi kesalahan server', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
