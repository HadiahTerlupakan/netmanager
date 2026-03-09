import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ApiErrors } from '@/lib/api-response';

export async function GET(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const payload = authResult;

        // Check Permission
        const permissions = payload.permissions || [];
        if (!permissions.includes('m_partners:read')) {
            return ApiErrors.forbidden('Akses ditolak: Memerlukan izin m_partners:read');
        }

        const userId = payload.id as string;
        const search = request.nextUrl.searchParams.get('search') || '';
        const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        const where: Prisma.UserWhereInput = {
            id: { not: userId },
            isActive: true,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ]
            }),
        };

        // Fetch users (excluding self) with pagination
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
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
                skip,
                take: limit,
                orderBy: { name: 'asc' }
            }),
            prisma.user.count({ where })
        ]);

        return NextResponse.json({
            success: true,
            data: users,
            message: 'Berhasil mengambil daftar partner',
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Mobile Partner List Error:', error);
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
    }
}
