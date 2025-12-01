// API to get active bank accounts for customers
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
    try {
        const accounts = await prisma.companyBankAccount.findMany({
            where: {
                isActive: true
            },
            select: {
                id: true,
                bankName: true,
                accountNumber: true,
                accountName: true,
                priority: true,
                description: true,
            },
            orderBy: [
                { priority: 'desc' },
                { bankName: 'asc' }
            ]
        })

        return NextResponse.json(accounts, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        })
    } catch (error) {
        console.error('Error fetching active bank accounts:', error)
        return NextResponse.json(
            { error: 'Failed to fetch bank accounts' },
            { status: 500 }
        )
    }
}
