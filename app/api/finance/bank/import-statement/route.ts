import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BankStatementRepository } from '@/lib/repositories/BankStatementRepository'

import FinanceAuthService from '@/lib/services/FinanceAuthService'
const bankStatementRepo = new BankStatementRepository(prisma)

export async function POST(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File
        const bankAccountId = formData.get('bankAccountId') as string

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
        }

        if (!bankAccountId) {
            return NextResponse.json({ error: 'Bank account ID required' }, { status: 400 })
        }

        // Read CSV file
        const text = await file.text()
        const lines = text.split('\n').filter((line) => line.trim())

        if (lines.length < 2) {
            return NextResponse.json({ error: 'CSV file is empty or invalid' }, { status: 400 })
        }

        // Parse CSV (assuming format: Date, Description, Reference, Debit, Credit, Balance)
        // Skip header row
        const statements = []
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map((v) => v.trim())

            if (values.length < 6) continue // Skip invalid rows

            try {
                const [dateStr, description, reference, debitStr, creditStr, balanceStr] = values

                // Parse date (format: DD/MM/YYYY or YYYY-MM-DD)
                let transactionDate: Date
                if (dateStr.includes('/')) {
                    const [day, month, year] = dateStr.split('/')
                    transactionDate = new Date(`${year}-${month}-${day}`)
                } else {
                    transactionDate = new Date(dateStr)
                }

                // Parse amounts (remove currency symbols and commas)
                const parseAmount = (str: string) => {
                    const cleaned = str.replace(/[^0-9.-]/g, '')
                    return cleaned ? parseFloat(cleaned) : 0
                }

                const debit = parseAmount(debitStr)
                const credit = parseAmount(creditStr)
                const balance = parseAmount(balanceStr)

                statements.push({
                    bankAccountId,
                    transactionDate,
                    description: description.replace(/"/g, ''), // Remove quotes
                    reference: reference || null,
                    debit: Math.round(debit),
                    credit: Math.round(credit),
                    balance: Math.round(balance)
                })
            } catch (error) {
                console.error(`Error parsing row ${i}:`, error)
                // Skip invalid rows
            }
        }

        if (statements.length === 0) {
            return NextResponse.json(
                { error: 'No valid transactions found in CSV' },
                { status: 400 }
            )
        }

        // Bulk insert
        const result = await bankStatementRepo.createMany(statements)

        return NextResponse.json({
            success: true,
            imported: result.count,
            total: statements.length,
            message: `Successfully imported ${result.count} bank statements`
        })
    } catch (error: any) {
        console.error('Error importing bank statement:', error)
        return NextResponse.json(
            { error: 'Failed to import bank statement', details: error.message },
            { status: 500 }
        )
    }
}
