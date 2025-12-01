// API for Company Bank Accounts (Admin CRUD)
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - List all company bank accounts
export async function GET(request: NextRequest) {
    try {
        const accounts = await prisma.companyBankAccount.findMany({
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'asc' }
            ]
        })

        return NextResponse.json(accounts)
    } catch (error) {
        console.error('Error fetching bank accounts:', error)
        return NextResponse.json(
            { error: 'Failed to fetch bank accounts' },
            { status: 500 }
        )
    }
}

// POST - Create new bank account
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { bankName, accountNumber, accountName, description, isActive, priority } = body

        if (!bankName || !accountNumber || !accountName) {
            return NextResponse.json(
                { error: 'Bank name, account number, and account name are required' },
                { status: 400 }
            )
        }

        const account = await prisma.companyBankAccount.create({
            data: {
                bankName,
                accountNumber,
                accountName,
                description,
                isActive: isActive ?? true,
                priority: priority ?? 1,
            }
        })

        return NextResponse.json(account, { status: 201 })
    } catch (error) {
        console.error('Error creating bank account:', error)
        return NextResponse.json(
            { error: 'Failed to create bank account' },
            { status: 500 }
        )
    }
}
