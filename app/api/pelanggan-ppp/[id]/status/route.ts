import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helpers';
import { RadiusSyncService } from '@/modules/network/services/radius-sync-service';
import { logger } from '@/lib/logger';
import { Status } from '@prisma/client';

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAdmin(req);
        if (session instanceof NextResponse) return session;

        const { id } = await context.params;
        const body = await req.json();
        const { status } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        if (!status || !Object.values(Status).includes(status)) {
            return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });
        }

        const pelanggan = await prisma.pelanggan.findUnique({
            where: { id }
        });

        if (!pelanggan) {
            return NextResponse.json({ error: 'Pelanggan not found' }, { status: 404 });
        }

        // Update Status
        const updatedPelanggan = await prisma.pelanggan.update({
            where: { id },
            data: { status }
        });

        // Trigger Radius Sync
        // We instantiate the service and call handleStatusChange manually to ensure it runs
        const radiusService = new RadiusSyncService(prisma);
        await radiusService.handleStatusChange(id, status);

        // Logging
        await logger.logActivity({
            action: 'UPDATE',
            subject: 'Pelanggan Status',
            details: {
                id: pelanggan.id,
                name: pelanggan.nama,
                oldStatus: pelanggan.status,
                newStatus: status,
                actor: session.user.name || 'Admin'
            },
            userId: session.user.id
        });

        return NextResponse.json({
            success: true,
            data: updatedPelanggan,
            message: `Status updated to ${status}`
        });

    } catch (error: any) {
        console.error('[API] Error updating status:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
