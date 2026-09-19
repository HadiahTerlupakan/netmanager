import { FinanceService } from "@/modules/finance";
import TreasuryClient from "./TreasuryClient";

export const dynamic = "force-dynamic";

export default async function TreasuryPage() {
  const financeService = new FinanceService();
  const [accounts, mutations] = await Promise.all([
    financeService.getAccounts(),
    financeService.getTreasuryMutations(),
  ]);

  return <TreasuryClient accounts={accounts} mutations={mutations} />;
}
