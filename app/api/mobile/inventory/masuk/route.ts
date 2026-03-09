import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { prisma } from '@/lib/prisma';
import { prismaMitra } from '@/lib/prisma-mitra';
import { socketEmitter } from '@/lib/websocket/emitter';
import { isSuperAdmin } from '@/lib/auth';

// POST - Create barang masuk (mobile)
export async function POST(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const payload = authResult;
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

        // Fallback: check Mitra table
        const mitra = !user ? await prismaMitra.mitra.findUnique({
            where: { id: userId },
            select: { id: true, siteId: true }
        }) : null;

        if (!user && !mitra) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
        }

        // Check for Site-Based Restriction Policy (only for User, Mitra skips)
        const userPermissions = user?.role?.permission.map(p => `${p.resource}:${p.action}`) || [];
        const isSuper = user ? isSuperAdmin({ role: user.role?.name }) : false;
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
                return NextResponse.json({ error: 'Gudang tidak ditemukan' }, { status: 404 });
            }

            const gudangSiteIds = targetGudang.sites.map(s => s.id);
            if (!gudangSiteIds.includes(user.sites?.id)) {
                return NextResponse.json({ error: 'Akses ditolak: Gudang di luar site Anda' }, { status: 403 });
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
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
    }
}
