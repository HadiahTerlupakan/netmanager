import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { USORepository } from '@/lib/repositories/USORepository';

const usoRepo = new USORepository(prisma);

// GET /api/finance/uso/[id] - Get USO detail
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const contribution = await usoRepo.findById(params.id);

        if (!contribution) {
            return NextResponse.json(
                { error: 'USO contribution not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(contribution);
    } catch (error) {
        console.error('[USO API] Error fetching USO detail:', error);
        return NextResponse.json(
            { error: 'Failed to fetch USO contribution' },
            { status: 500 }
        );
    }
}

// PUT /api/finance/uso/[id] - Update USO
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();

        const contribution = await usoRepo.update(params.id, body);

        return NextResponse.json(contribution);
    } catch (error: any) {
        console.error('[USO API] Error updating USO:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update USO contribution' },
            { status: 500 }
        );
    }
}

// DELETE /api/finance/uso/[id] - Delete USO
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await usoRepo.delete(params.id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[USO API] Error deleting USO:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete USO contribution' },
            { status: 500 }
        );
    }
}
