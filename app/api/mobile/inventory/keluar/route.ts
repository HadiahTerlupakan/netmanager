import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { getInventoryRepository } from '@/lib/repositories';
import { socketEmitter } from '@/lib/websocket/emitter';
import { logger } from '@/lib/logger';

// POST - Create barang keluar (mobile)
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Token not provided' }, { status: 401 });
        }
        const payload = await verifyMobileToken(token);

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

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

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
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

        // Check for Site-Based Restriction Policy
        const userPermissions = user.role?.permission.map(p => `${p.resource}:${p.action}`) || [];
        const isSuper = user.role?.name === 'SUPER_ADMIN' || user.role?.name === 'Super Admin';
        const isSiteRestricted = !isSuper && userPermissions.includes('k_barang:site_only');

        if (isSiteRestricted) {
            if (!user.sites?.id) {
                return NextResponse.json({ error: 'Access denied: No site assigned' }, { status: 403 });
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
                return NextResponse.json({ error: 'Access denied: Gudang outside your site' }, { status: 403 });
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
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
