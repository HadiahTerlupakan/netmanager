import { NextRequest, NextResponse } from 'next/server';
import { ProcurementService } from '@/modules/procurement';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const service = new ProcurementService();

type Props = {
    params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const po = await service.getPurchaseOrderById(params.id);
        if (!po) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
        return NextResponse.json(po);
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        // Remove unsafe fields?
        const { id: _id, poNumber: _poNumber, createdBy: _createdBy, ...data } = body;

        const result = await service.updatePurchaseOrder(params.id, data);
        return NextResponse.json(result);
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const result = await service.deletePurchaseOrder(params.id);
        return NextResponse.json(result);
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
