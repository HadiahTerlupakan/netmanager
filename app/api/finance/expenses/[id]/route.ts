import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { amount, date, category, description } = body;

        const expense = await prisma.expense.update({
            where: {
                id: id,
            },
            data: {
                amount: BigInt(amount),
                date: new Date(date),
                category,
                description,
            },
            include: {
                user: {
                    select: {
                        name: true
                    }
                }
            }
        });

        return NextResponse.json({
            ...expense,
            amount: expense.amount.toString(),
        });
    } catch (error) {
        console.error("[EXPENSE_PUT]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const expense = await prisma.expense.delete({
            where: {
                id: id,
            },
        });

        return NextResponse.json({
            ...expense,
            amount: expense.amount.toString(),
        });
    } catch (error) {
        console.error("[EXPENSE_DELETE]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
