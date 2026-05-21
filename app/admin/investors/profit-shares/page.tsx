import { ensurePermission } from "@/lib/rbac";
import ProfitSharesClient from "./ProfitSharesClient";

export const dynamic = "force-dynamic";

export default async function ProfitSharesPage() {
  await ensurePermission("investors:manage");
  return <ProfitSharesClient />;
}
