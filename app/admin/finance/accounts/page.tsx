import { FinanceService } from '@/modules/finance'
import TreasuryClient from './TreasuryClient'

export const dynamic = 'force-dynamic'

export default async function TreasuryPage() {
  const financeService = new FinanceService()
  const accounts = await financeService.getAccounts()

  return <TreasuryClient accounts={accounts} />
}
