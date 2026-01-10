import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { socketEmitter } from '@/lib/websocket/emitter';

// POST - Create barang masuk (mobile)
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = await verifyMobileToken(token);

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const userId = payload.id as string;
        const body = await request.json();
        const { barangId, gudangId, jumlah, kondisi, keterangan, supplier, fotoBukti } = body;

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

        // Check for Site-Based Restriction Policy
        const userPermissions = user.role?.permission.map(p => `${p.resource}:${p.action}`) || [];
        const roleName = (user.role?.name || '').trim().toUpperCase().replace(/\s+/g, '_');
        const isSuperAdmin = roleName === 'SUPER_ADMIN';
        const isSiteRestricted = !isSuperAdmin && userPermissions.includes('k_barang:site_only');

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
            if (!gudangSiteIds.includes(user.sites?.id)) {
                return NextResponse.json({ error: 'Access denied: Gudang outside your site' }, { status: 403 });
            }
        }

        // Determine stock field based on kondisi
        const stockField = kondisi === 'BEKAS' ? 'stokBekas' : kondisi === 'RUSAK' ? 'stokRusak' : 'stokBaru';

        // Create barang masuk and update stock in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create barang masuk
            const masuk = await tx.barangMasuk.create({
                data: {
                    id: crypto.randomUUID(),
                    barangId,
                    gudangId,
                    jumlah,
                    kondisi: kondisi || 'BARU',
                    keterangan,
                    supplier,
                    fotoBukti: fotoBukti || [],
                    userId
                },
                include: { barang: true, gudang: true }
            });

            // Update or create stock
            await tx.barangGudang.upsert({
                where: {
                    barangId_gudangId: { barangId, gudangId }
                },
                create: {
                    id: crypto.randomUUID(),
                    barangId,
                    gudangId,
                    stok: jumlah,
                    [stockField]: jumlah,
                    updatedAt: new Date()
                },
                update: {
                    stok: { increment: jumlah },
                    [stockField]: { increment: jumlah },
                    updatedAt: new Date()
                }
            });

            return masuk;
        });

        // Emit real-time update via WebSocket
        socketEmitter.inventoryUpdate({
            type: 'masuk',
            userId,
            barangId,
            gudangId,
            jumlah
        });

        return NextResponse.json({ 
            success: true, 
            data: result 
        });
    } catch (error) {
        console.error('Mobile Barang Masuk Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
