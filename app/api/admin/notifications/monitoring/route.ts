import { NextResponse, NextRequest } from 'next/server';
import { getRetryQueueStats } from '@/modules/notification/services/PushRetryQueue';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        // Verify admin access
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: { role: true },
        });

        if (!dbUser || (dbUser.role?.name !== 'SUPER_ADMIN' && !dbUser.role?.accessAdminPanel)) {
            return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
        }

        const stats = await getRetryQueueStats();

        return NextResponse.json({
            success: true,
            data: stats,
            message: 'Berhasil mengambil statistik antrean push retry'
        });
    } catch (error: unknown) {
        console.error('[API] Error fetching push queue stats:', error);
        const errorMessage = error instanceof Error ? error.message : 'Gagal mengambil statistik antrean push';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
