import UnpaidBillsClient from './UnpaidBillsClient'
import { FinancePageQueriesService } from '@/modules/finance'

export const dynamic = 'force-dynamic'

export default async function UnpaidBillsPage() {
  const pageService = new FinancePageQueriesService()
  const { unpaidPos, accounts } = await pageService.getUnpaidBillsPageData()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <UnpaidBillsClient initialData={unpaidPos as any} accounts={accounts} />
}
