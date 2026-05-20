import { ensurePermission } from "@/lib/rbac";
import { TrialBalanceClient } from "./TrialBalanceClient";

export default async function TrialBalancePage() {
  await ensurePermission("accounting:read");
  return <TrialBalanceClient />;
}
