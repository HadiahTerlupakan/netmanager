import { ensurePermission } from "@/lib/rbac";
import { ExportPajakClient } from "./ExportPajakClient";

export default async function ExportPajakPage() {
  await ensurePermission("tax:read");
  return <ExportPajakClient />;
}
