import { ensurePermission } from "@/lib/rbac";
import { PeriodeClient } from "./PeriodeClient";

export default async function PeriodePage() {
  await ensurePermission("accounting:read");
  return <PeriodeClient />;
}
