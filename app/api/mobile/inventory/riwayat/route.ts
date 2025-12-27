import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';

// GET - Get transaction history for mobile
export async function GET(request: NextRequest) {
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
        const isSiteRestricted = userPermissions.includes('k_barang:site_only');

        let whereClauseMasuk: any = { userId };
        let whereClauseKeluar: any = { userId };

        if (isSiteRestricted && user.sites?.id) {
            // Filter transactions where the specific Gudang belongs to the user's Site
            whereClauseMasuk.gudang = { sites: { some: { id: user.sites?.id } } };
            whereClauseKeluar.gudang = { sites: { some: { id: user.sites?.id } } };
        }

        // Get barang masuk
        const barangMasuk = await prisma.barangMasuk.findMany({
            where: whereClauseMasuk,
            include: {
                barang: { select: { kode: true, nama: true, satuan: true } },
                gudang: { select: { nama: true } }
            },
            orderBy: { tanggal: 'desc' },
            take: 50
        });

        // Get barang keluar
        const barangKeluar = await prisma.barangKeluar.findMany({
            where: whereClauseKeluar,
            include: {
                barang: { select: { kode: true, nama: true, satuan: true } },
                gudang: { select: { nama: true } }
            },
            orderBy: { tanggal: 'desc' },
            take: 50
        });

        // Combine and sort
        const transactions = [
            ...barangMasuk.map(m => ({
                id: m.id,
                type: 'masuk' as const,
                barang: m.barang,
                gudang: m.gudang,
                jumlah: m.jumlah,
                kondisi: m.kondisi,
                keterangan: m.keterangan,
                tanggal: m.tanggal.toISOString()
            })),
            ...barangKeluar.map(k => ({
                id: k.id,
                type: 'keluar' as const,
                barang: k.barang,
                gudang: k.gudang,
                jumlah: k.jumlah,
                kondisi: k.kondisi,
                keterangan: k.keterangan,
                tanggal: k.tanggal.toISOString()
            }))
        ].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

        return NextResponse.json({ 
            success: true,
            data: transactions 
        });
    } catch (error) {
        console.error('Mobile Inventory History Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
