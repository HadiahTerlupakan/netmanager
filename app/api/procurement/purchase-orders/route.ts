import { NextRequest, NextResponse } from 'next/server';
import { ProcurementService } from '@/modules/procurement';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const service = new ProcurementService();

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || undefined;
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = parseInt(searchParams.get('take') || '10');

    // Status filter
    const statusParam = searchParams.get('status');

    try {
        const result = await service.getPurchaseOrders({
            ...(search && { search }),
            skip,
            take,
            status: statusParam as "DRAFT" | "ORDERED" | "PARTIAL" | "RECEIVED" | "CANCELLED" | undefined
        });
        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });

    try {
        const body = await req.json();

        const userId = (session.user as { id?: string })?.id || session.user?.email || 'unknown';

        // Remove unused fields from body if present
        const { poNumber: _, createdBy: __, ...data } = body;

        const result = await service.createPurchaseOrder(data, userId);
        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
