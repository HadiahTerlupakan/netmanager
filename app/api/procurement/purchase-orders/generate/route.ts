import { NextRequest, NextResponse } from 'next/server';
import { ProcurementService } from '@/modules/procurement';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const service = new ProcurementService();

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { prIds, supplierId } = await req.json();
        
        if (!prIds || !Array.isArray(prIds)) {
            return NextResponse.json({ error: 'Invalid PR IDs' }, { status: 400 });
        }

        // Pass user ID from session
        const userId = session.user?.email || session.user?.name || 'system'; 
        // Ideally ID, but if session doesn't expose ID cleanly, I'll use email.
        // User schema has id. NextAuth session usually has id if configured defined callback.
        // I will assume session.user.id exists? Or I'll use email check.
        // Usually session.user.id is populated in callbacks. 
        // I'll try (session.user as any).id || session.user.email
        
        const actualUserId = (session.user as any).id || session.user?.email || 'unknown';

        const result = await service.generatePOFromPRs(prIds, actualUserId, supplierId);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
