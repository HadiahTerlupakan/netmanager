import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { prisma } from '@/lib/prisma';
import { prismaMitra } from '@/lib/prisma-mitra';
import { getInventoryRepository } from '@/lib/repositories';
import { socketEmitter } from '@/lib/websocket/emitter';
import { logger } from '@/lib/logger';

// POST - Create barang keluar (mobile)
export async function POST(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const payload = authResult;
        const userId = payload.id as string;
        const body = await request.json();
        const { barangId, gudangId, jumlah, kondisi, keterangan, tujuanPenggunaan, fotoBukti } = body;

        if (!barangId || !gudangId || !jumlah || jumlah <= 0) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
        }

        // Fetch user to check permissions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                role: { include: { permission: true } },
                sites: true
            }
        });

        // Fallback: check Mitra table
        const mitra = !user ? await prismaMitra.mitra.findUnique({
            where: { id: userId },
            select: { id: true, siteId: true }
        }) : null;

        if (!user && !mitra) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
        }

        // Check stock
        const barangGudang = await prisma.barangGudang.findUnique({
            where: {
                barangId_gudangId: { barangId, gudangId }
            },
            include: {
                barang: { select: { nama: true } }
            }
        });

        // Check available stock based on kondisi
        const stockField = kondisi === 'BEKAS' ? 'stokBekas' : kondisi === 'RUSAK' ? 'stokRusak' : 'stokBaru';
        const availableStock = barangGudang ? (barangGudang as unknown as Record<string, number>)[stockField] || 0 : 0;

        if (!barangGudang || availableStock < jumlah) {
            return NextResponse.json({
                error: `Stok ${kondisi || 'BARU'} tidak mencukupi. Tersedia: ${availableStock}`
            }, { status: 400 });
        }

        // Check for Site-Based Restriction Policy (only for User, Mitra skips)
        const userPermissions = user?.role?.permission.map(p => `${p.resource}:${p.action}`) || [];
        const isSuper = user ? (user.role?.name === 'SUPER_ADMIN' || user.role?.name === 'Super Admin') : false;
        const isSiteRestricted = user ? (!isSuper && userPermissions.includes('k_barang:site_only')) : false;

        if (isSiteRestricted && user) {
            if (!user.sites?.id) {
                return NextResponse.json({ error: 'Akses ditolak: Tidak ada site yang ditugaskan' }, { status: 403 });
            }

            // Verify the target gudang belongs to user's site
            const targetGudang = await prisma.gudang.findUnique({
                where: { id: gudangId },
                include: { sites: { select: { id: true } } }
            });

            if (!targetGudang) {
                return NextResponse.json({ error: 'Gudang not found' }, { status: 404 });
            }

            const gudangSiteIds = targetGudang.sites.map(s => s.id);
            if (!gudangSiteIds.includes(user.sites?.id || '')) {
                return NextResponse.json({ error: 'Akses ditolak: Gudang di luar site Anda' }, { status: 403 });
            }
        }

        // Use Repository for consistency
        const inventoryRepository = getInventoryRepository();

        const result = await inventoryRepository.removeStock({
            barangId,
            gudangId,
            jumlah,
            kondisi: kondisi || 'BARU',
            keterangan,
            tujuanPenggunaan,
            fotoBukti: fotoBukti || [],
            userId,
            tanggal: new Date()
        });

        // Emit real-time update via WebSocket
        socketEmitter.inventoryUpdate({
            type: 'keluar',
            userId,
            barangId,
            gudangId,
            jumlah
        });

        // Log activity
        await logger.logActivity({
            action: 'CREATE',
            subject: 'Inventory Out (Mobile)',
            details: {
                barangId,
                namaBarang: barangGudang?.barang?.nama,
                jumlah,
                kondisi,
                gudangId,
                keterangan,
                tujuanPenggunaan
            },
            userId
        });

        return NextResponse.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Mobile Barang Keluar Error:', error);
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
    }
}
