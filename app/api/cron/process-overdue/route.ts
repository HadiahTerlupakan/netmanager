import { NextResponse } from 'next/server';
import { AutomaticIsolationService } from '@/modules/finance';

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        
        // Use a secure token via environment variable or a strong default for fallback
        const CRON_SECRET = process.env.CRON_SECRET || 'netmanager-secure-cron-key-123';
        
        // Basic Authorization check to prevent abuse
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            console.warn('[Cron] Unauthorized attempt to run overdue check');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron] Starting daily overdue and isolation check');
        
        // Execute the daily check logic
        await AutomaticIsolationService.runDailyCheck();

        console.log('[Cron] Completed daily overdue and isolation check');
        return NextResponse.json({ success: true, message: 'Daily check completed successfully' });
    } catch (error: unknown) {
        console.error('[Cron] Error running daily check:', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
