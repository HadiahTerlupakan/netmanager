import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Format token tidak valid' }, { status: 401 });
        }

        const payload = await verifyMobileToken(token);

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
        }

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

        return apiSuccess(users, {
            message: 'Berhasil mengambil daftar partner',
            // @ts-ignore - manual pagination structure for now
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
