import { prisma } from '@/lib/prisma'
import TransactionsClient from './TransactionsClient'

export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  const categories = await prisma.transactionCategory.findMany({
    orderBy: { name: 'asc' }
  })
  
  const accounts = await prisma.financialAccount.findMany({
    where: { isActive: true },
    orderBy: { type: 'asc' }
  })

  // Basic serialization if needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedAccounts = accounts.map((a: any) => ({
    ...a,
    balance: Number(a.balance)
  }))

  return <TransactionsClient categories={categories} accounts={formattedAccounts} />
}
