import { NextRequest, NextResponse } from "next/server";
import { prismaBilling } from "@/lib/prisma-billing";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'PENDING';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const skip = (page - 1) * limit;

        const whereCondition: { status?: 'PENDING' | 'RESOLVED' | 'IGNORED' } = {};

        if (status !== 'ALL') {
            whereCondition.status = status as 'PENDING' | 'RESOLVED' | 'IGNORED';
        }

        const [total, mutations] = await Promise.all([
            prismaBilling.unmatchedMutation.count({ where: whereCondition }),
            prismaBilling.unmatchedMutation.findMany({
                where: whereCondition,
                orderBy: { date: 'desc' },
                skip,
                take: limit,
            })
        ]);

        return NextResponse.json({
            mutations,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Failed to fetch unmatched mutations:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { mutationId, invoiceId, action } = body;
        // action can be 'RESOLVE' or 'IGNORE'

        if (!mutationId || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const mutation = await prismaBilling.unmatchedMutation.findUnique({
            where: { id: mutationId }
        });

        if (!mutation) {
            return NextResponse.json({ error: "Mutation not found" }, { status: 404 });
        }

        if (action === 'IGNORE') {
            const updated = await prismaBilling.unmatchedMutation.update({
                where: { id: mutationId },
                data: {
                    status: 'IGNORED',
                    resolvedAt: new Date(),
                    resolvedById: session.user.id
                }
            });
            return NextResponse.json({ success: true, mutation: updated });
        }

        if (action === 'RESOLVE') {
            if (!invoiceId) {
                return NextResponse.json({ error: "Invoice ID required for resolving" }, { status: 400 });
            }

            // Find invoice
            const invoice = await prismaBilling.invoice.findUnique({
                where: { id: invoiceId }
            });

            if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

            // Create Payment
            const payment = await prismaBilling.payment.create({
                data: {
                    id: `PAY-${Date.now()}`,
                    amount: BigInt(mutation.amount.toString()),
                    paymentDate: mutation.date,
                    paymentMethod: 'BANK_TRANSFER',
                    notes: `Resolved from unmatched mutation ${mutation.transactionId}`,
                    verifiedBy: session.user?.id || 'SYSTEM',
                    verifiedAt: new Date(),
                    transactionId: mutation.transactionId || undefined,
                    gatewayStatus: 'PAID',
                    gatewayProvider: mutation.provider,
                    pelangganId: invoice.pelangganId,
                    invoice: { connect: { id: invoice.id } },
                    unmatchedMutation: { connect: { id: mutation.id } },
                    updatedAt: new Date()
                }
            });

            // Update mutation status
            const updated = await prismaBilling.unmatchedMutation.update({
                where: { id: mutationId },
                data: {
                    status: 'RESOLVED',
                    matchedInvoiceId: invoice.id,
                    resolvedAt: new Date(),
                    resolvedById: session.user.id
                }
            });

            return NextResponse.json({ success: true, payment, mutation: updated });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error) {
        console.error("Failed to process unmatched mutation:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
