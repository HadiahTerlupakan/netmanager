import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
        }

        const payload = await verifyMobileToken(token);

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Check Permission
        const permissions = payload.permissions || [];
        if (!permissions.includes('m_partners:read')) {
            return NextResponse.json({ error: 'Forbidden: Requires m_partners:read permission' }, { status: 403 });
        }

        const userId = payload.id as string;
        const search = request.nextUrl.searchParams.get('search') || '';

        // Fetch users (excluding self)
        const users = await prisma.user.findMany({
            where: {
                id: { not: userId },
                isActive: true,
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } }
                    ]
                }),
                // Optional: Filter by site or role if needed
                // siteId: ...
            },
            select: {
                id: true,
                name: true,
                role: {
                    select: { name: true }
                },
                sites: {
                    select: { name: true }
                }
            },
            take: 20
        });

        return NextResponse.json({
            success: true,
            data: users
        });

    } catch (error) {
        console.error('Mobile Partner List Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
