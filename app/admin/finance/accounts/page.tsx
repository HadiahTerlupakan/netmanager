import { prisma } from '@/lib/prisma'
import TreasuryClient from './TreasuryClient'

export const dynamic = 'force-dynamic'

export default async function TreasuryPage() {
  const accounts = await prisma.financialAccount.findMany({
    orderBy: {
      type: 'asc',
    }
  })

  // Serialize if needed (though balance is Float, checking schema again... yes Float in FinancialAccount. balance BigInt in others? No, balance Float in FinancialAccount based on my schema update.)
  // Wait, I should verify my schema update. I used `balance Float @default(0)`.
  // Prisma usually returns number for Float.

  return <TreasuryClient accounts={accounts} />
}
