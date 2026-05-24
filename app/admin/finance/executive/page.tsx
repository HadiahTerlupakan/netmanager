import { ensurePermission } from "@/lib/rbac";
import { ExecutiveDashboardClient } from "./ExecutiveDashboardClient";

export const metadata = {
  title: "Executive Dashboard",
  description: "Dashboard MRR/ARR & customer health",
};

export default async function Page() {
  await ensurePermission("finance:read");
  return <ExecutiveDashboardClient />;
}
