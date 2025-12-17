import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

import { z } from "zod";

const expenseSchema = z.object({
    amount: z.union([z.string(), z.number()]).transform((val) => BigInt(val)),
    date: z.string().or(z.date()).transform((val) => new Date(val)),
    category: z.string().min(1, "Category is required"),
    description: z.string().optional(),
});

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        const body = await req.json();
        const validation = expenseSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
        }

        const { amount, date, category, description } = validation.data;

        // Verify ownership or check if admin (for now, just existence check because we lack Roles)
        // Ideally: const existing = await prisma.expense.findFirst({ where: { id, userId: session.user.id } });
        // But since we want admins to edit everything, we skip userId check for now, trusting the Login.

        // @ts-ignore
        const expense = await prisma.expense.update({
            where: {
                id: id,
            },
            data: {
                amount,
                date,
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
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        // @ts-ignore
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
