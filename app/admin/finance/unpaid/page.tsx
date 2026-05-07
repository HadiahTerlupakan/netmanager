import UnpaidBillsClient from "./UnpaidBillsClient";
import { FinancePageQueriesService } from "@/modules/finance";
import type { UnpaidPurchaseOrderWithTransactions } from "@/modules/finance";

export const dynamic = "force-dynamic";

export default async function UnpaidBillsPage() {
  const pageService = new FinancePageQueriesService();
  const { unpaidPos, accounts } = await pageService.getUnpaidBillsPageData();

  return (
    <UnpaidBillsClient
      initialData={unpaidPos as UnpaidPurchaseOrderWithTransactions[]}
      accounts={accounts}
    />
  );
}
