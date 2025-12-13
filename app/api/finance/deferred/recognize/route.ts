import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { DeferredRevenueRepository } from '@/lib/repositories/DeferredRevenueRepository';

import FinanceAuthService from '@/lib/services/FinanceAuthService'
const deferredRepo = new DeferredRevenueRepository(prisma);

// POST /api/finance/deferred/recognize - Manually trigger recognition
export async function POST(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { month, deferredIds, recognizedBy } = body;

        if (!month) {
            return NextResponse.json(
                { error: 'month is required' },
                { status: 400 }
            );
        }

        const recognitionDate = new Date(month);
        const results = [];
        const errors = [];

        // If specific IDs provided, recognize only those
        if (deferredIds && Array.isArray(deferredIds)) {
            for (const id of deferredIds) {
                try {
                    const recognition = await deferredRepo.recognizeRevenue(
                        id,
                        recognitionDate,
                        recognizedBy || 'system'
                    );
                    results.push(recognition);
                } catch (error: any) {
                    errors.push({ id, error: error.message });
                }
            }
        } else {
            // Otherwise, find and recognize all due
            const dueDeferred = await deferredRepo.findDueForRecognition(recognitionDate);

            for (const deferred of dueDeferred) {
                try {
                    const recognition = await deferredRepo.recognizeRevenue(
                        deferred.id,
                        recognitionDate,
                        recognizedBy || 'system'
                    );
                    results.push(recognition);
                } catch (error: any) {
                    errors.push({ id: deferred.id, error: error.message });
                }
            }
        }

        return NextResponse.json({
            recognized: results.length,
            failed: errors.length,
            results,
            errors,
        });
    } catch (error: any) {
        console.error('[Deferred API] Error recognizing revenue:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to recognize revenue' },
            { status: 500 }
        );
    }
}
