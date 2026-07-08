import { ensurePermission } from "@/lib/rbac";
import ResellersClient from "./ResellersClient";

export const dynamic = "force-dynamic";

export default async function ResellersPage() {
  await ensurePermission("reseller:read");
  return <ResellersClient />;
}
