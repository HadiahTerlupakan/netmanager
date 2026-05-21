import { ensurePermission } from "@/lib/rbac";
import { KonfigurasiPajakClient } from "./KonfigurasiPajakClient";

export default async function KonfigurasiPajakPage() {
  await ensurePermission("tax:read");
  return <KonfigurasiPajakClient />;
}
