import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/admin/departments - List all departments
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const departments = await prisma.department.findMany({
            where,
            include: {
                _count: {
                    select: {
                        employees: true,
                        workOrders: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({
            success: true,
            data: departments,
        });
    } catch (error) {
        console.error('Error fetching departments:', error);
        return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }
}

// POST /api/admin/departments - Create new department
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, jobDescription } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        // Check if name already exists
        const existingDept = await prisma.department.findUnique({
            where: { name },
        });

        if (existingDept) {
            return NextResponse.json(
                { error: 'Department name already exists' },
                { status: 400 }
            );
        }

        const department = await prisma.department.create({
            data: {
                name,
                description: description || null,
                jobDescription: jobDescription || null,
            },
        });

        return NextResponse.json({
            success: true,
            data: department,
            message: 'Department created successfully',
        });
    } catch (error) {
        console.error('Error creating department:', error);
        return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
    }
}
