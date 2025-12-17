
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { TargetAudience } from '@prisma/client';

export async function GET(request: NextRequest) {
    try {
        const session = await requireAuth(request);
        const { searchParams } = new URL(request.url);

        const target = searchParams.get('target') as TargetAudience | undefined;
        const activeOnly = searchParams.get('active') === 'true';
        const portal = searchParams.get('portal'); // 'admin', 'customer', 'employee'

        // Base query
        let where: any = {};

        // If accessed from a specific portal, filter accordingly
        if (portal === 'customer') {
            where = {
                target: { in: ['ALL', 'CUSTOMER'] },
                isActive: true,
                startDate: { lte: new Date() },
                OR: [
                    { endDate: null },
                    { endDate: { gte: new Date() } }
                ]
            };
        } else if (portal === 'employee') {
            where = {
                target: { in: ['ALL', 'EMPLOYEE'] },
                isActive: true,
                startDate: { lte: new Date() },
                OR: [
                    { endDate: null },
                    { endDate: { gte: new Date() } }
                ]
            };
        } else if (portal === 'admin') {
            // Admin portal might want to see announcements for admins
            where = {
                target: { in: ['ALL', 'ADMIN'] },
                isActive: true, // Or maybe all?
                startDate: { lte: new Date() }
            };
        } else {
            // Admin management view (shows everything)
            // Allow filtering if provided
            if (target) where.target = target;
            if (activeOnly) where.isActive = true;
        }


        const announcements = await prisma.announcement.findMany({
            where,
            orderBy: [
                { isPinned: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return NextResponse.json(announcements);

    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth(request);
        // Verify admin role if needed, assuming requireAuth checks login
        // if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const body = await request.json();
        const { title, content, target, isActive, isPinned, startDate, endDate } = body;

        const announcement = await prisma.announcement.create({
            data: {
                title,
                content,
                target,
                isActive: isActive ?? true,
                isPinned: isPinned ?? false,
                startDate: startDate ? new Date(startDate) : new Date(), // Default to now if not provided
                endDate: endDate ? new Date(endDate) : null,
                createdBy: session.user.id
            }
        });

        return NextResponse.json(announcement);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
