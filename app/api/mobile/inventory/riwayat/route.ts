
import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';

// GET - Get transaction history for mobile (Optimized)
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Token not provided' }, { status: 401 })
        }
        const payload = await verifyMobileToken(token);

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const userId = payload.id as string;
        const searchParams = request.nextUrl.searchParams;
        const filterType = searchParams.get('type'); // 'masuk' | 'keluar' | 'all'
        
        // Cursor-based pagination parameters
        // Cursor format: "timestamp_id" (isoDate_uuid) or just isoDate?
        // Let's use skip/take for simplify migration first, or timestamp as cursor.
        // Using timestamp as cursor is good for infinite scroll.
        // But simplified Approach for now: Page/Limit or just Limit with Cursor.
        // Let's use simplified "cursor" = last timestamp.
        
        const cursorValues = searchParams.get('cursor'); // Timestamp string of last item
        const limit = 20; // Default limit

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

        const whereClauseMasuk: Record<string, unknown> = { userId };
        const whereClauseKeluar: Record<string, unknown> = { userId };

        if (isSiteRestricted && user.sites?.id) {
            // Filter transactions where the specific Gudang belongs to the user's Site
            whereClauseMasuk.gudang = { sites: { some: { id: user.sites?.id } } };
            whereClauseKeluar.gudang = { sites: { some: { id: user.sites?.id } } };
        }
        
        // Handle cursor timestamp for pagination
        if (cursorValues) {
             const cursorDate = new Date(cursorValues);
             whereClauseMasuk.tanggal = { lt: cursorDate };
             whereClauseKeluar.tanggal = { lt: cursorDate };
        }

        let transactions: Record<string, unknown>[] = [];

        if (filterType === 'masuk') {
            const barangMasuk = await prisma.barangMasuk.findMany({
                where: whereClauseMasuk,
                include: {
                    barang: { select: { kode: true, nama: true, satuan: true } },
                    gudang: { select: { nama: true } }
                },
                orderBy: { tanggal: 'desc' },
                take: limit + 1
            });
            
            transactions = barangMasuk.map(m => ({
                id: m.id,
                type: 'masuk' as const,
                barang: m.barang,
                gudang: m.gudang,
                jumlah: m.jumlah,
                kondisi: m.kondisi,
                keterangan: m.keterangan,
                tanggal: m.tanggal.toISOString()
            }));
            
        } else if (filterType === 'keluar') {
             const barangKeluar = await prisma.barangKeluar.findMany({
                where: whereClauseKeluar,
                include: {
                    barang: { select: { kode: true, nama: true, satuan: true } },
                    gudang: { select: { nama: true } }
                },
                orderBy: { tanggal: 'desc' },
                take: limit + 1
            });
            
            transactions = barangKeluar.map(k => ({
                id: k.id,
                type: 'keluar' as const,
                barang: k.barang,
                gudang: k.gudang,
                jumlah: k.jumlah,
                kondisi: k.kondisi,
                keterangan: k.keterangan,
                tanggal: k.tanggal.toISOString()
            }));

        } else {
            // Fetch combined (all) - Tricky for cursor based without knowing "next" source.
            // Simplified "Feed" Approach: Fetch 'limit' from BOTH, merge, sort, take 'limit'.
            // This is acceptable because 'limit' is small (20).
            
            const [barangMasuk, barangKeluar] = await Promise.all([
                prisma.barangMasuk.findMany({
                    where: whereClauseMasuk,
                    include: {
                        barang: { select: { kode: true, nama: true, satuan: true } },
                        gudang: { select: { nama: true } }
                    },
                    orderBy: { tanggal: 'desc' },
                    take: limit
                }),
                prisma.barangKeluar.findMany({
                    where: whereClauseKeluar,
                    include: {
                        barang: { select: { kode: true, nama: true, satuan: true } },
                        gudang: { select: { nama: true } }
                    },
                    orderBy: { tanggal: 'desc' },
                    take: limit
                })
            ]);

            const merged = [
                ...barangMasuk.map(m => ({
                    id: m.id,
                    type: 'masuk' as const,
                    barang: m.barang,
                    gudang: m.gudang,
                    jumlah: m.jumlah,
                    kondisi: m.kondisi,
                    keterangan: m.keterangan,
                    tanggal: m.tanggal.toISOString(),
                    rawDate: m.tanggal 
                })),
                ...barangKeluar.map(k => ({
                    id: k.id,
                    type: 'keluar' as const,
                    barang: k.barang,
                    gudang: k.gudang,
                    jumlah: k.jumlah,
                    kondisi: k.kondisi,
                    keterangan: k.keterangan,
                    tanggal: k.tanggal.toISOString(),
                    rawDate: k.tanggal
                }))
            ];
            
            // Sort merged results
            transactions = merged.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
        }

        // Apply Final Limit for combined result (if 'all') or single (if filter)
        // Check next cursor.
        let nextCursor = null;
        
        if (transactions.length > limit) {
             const nextItem = transactions[limit - 1]; // The 20th item
             nextCursor = nextItem.tanggal;
             transactions = transactions.slice(0, limit);
        } else if (transactions.length === limit && filterType !== 'all') {
             // If exactly limit, we don't know if there is more unless we fetched limit+1
             // My logic for single tables fetched limit+1.
             // But for 'all' I fetched limit from both.
             // If 'all', I have potential up to 40 items. I slice 20.
             // If I have < 20 items total, no cursor.
             // If I have > 20 items, nextCursor is 20th item's date.
        }

        // Logic fix for 'all' nextCursor:
        // If I fetched 20 from A and 20 from B. I have 40.
        // I sort and take top 20.
        // Next cursor is the date of the LAST item in the top 20.
        // Clientside asks for cursor < last_date.
        
        if (transactions.length > 0) {
            // Only set next cursor if we likely have more data
            // For 'all' - if we got full 'limit' from either source, assume more exists?
            // Actually, simply returning the last item's date as nextCursor is standard for infinite scroll.
            // Client: If received items < limit, stop.
            if (transactions.length === limit) { 
               nextCursor = transactions[transactions.length - 1].tanggal;
            }
        }

        return NextResponse.json({ 
            success: true,
            data: transactions.map(({ rawDate: _, ...rest }) => rest), // Remove internal helper
            nextCursor,
        });

    } catch (error) {
        console.error('Mobile Inventory History Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
