import { NextRequest, NextResponse } from 'next/server';
import { ProcurementService } from '@/modules/procurement';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const service = new ProcurementService();

export async function GET(_req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const result = await service.getAvailablePRs();
        return NextResponse.json(result);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
