import { ensurePermission } from "@/lib/rbac";
import { TransaksiPajakClient } from "./TransaksiPajakClient";

export default async function TransaksiPajakPage() {
  await ensurePermission("tax:read");
  return <TransaksiPajakClient />;
}
