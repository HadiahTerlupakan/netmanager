import { NextRequest, NextResponse } from 'next/server';
import { ProcurementService } from '@/modules/procurement';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const service = new ProcurementService();

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || undefined;
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = parseInt(searchParams.get('take') || '10');

    try {
        const result = await service.getSuppliers({
            ...(search && { search }),
            skip,
            take
        });
        return NextResponse.json(result);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check permission?
    // const { hasPermission } = usePermission() // Hook not avail here.
    // Ideally verify session.user.role permissions.

    try {
        const body = await req.json();
        const result = await service.createSupplier(body);
        return NextResponse.json(result);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
