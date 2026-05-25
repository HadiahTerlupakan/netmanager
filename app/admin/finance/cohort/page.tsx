import { ensurePermission } from "@/lib/rbac";
import { CustomerCohortClient } from "./CustomerCohortClient";

export const metadata = {
  title: "Customer Cohort Analysis",
  description: "Retention & revenue per generasi pelanggan",
};

export default async function Page() {
  await ensurePermission("finance:read");
  return <CustomerCohortClient />;
}
