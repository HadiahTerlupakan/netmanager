import { NextRequest, NextResponse } from 'next/server';
import { ProcurementService } from '@/modules/procurement';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const service = new ProcurementService();

interface Context {
    params: Promise<{
        id: string;
    }>
}

export async function GET(req: NextRequest, { params }: Context) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });

    try {
        const { id } = await params;
        const result = await service.getSupplierById(id);
        if (!result) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
        return NextResponse.json(result);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan server'
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: Context) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });

    try {
        const { id } = await params;
        const body = await req.json();
        const result = await service.updateSupplier(id, body);
        return NextResponse.json(result);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan server'
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Context) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });

    try {
        const { id } = await params;
        const result = await service.deleteSupplier(id);
        return NextResponse.json(result);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan server'
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
