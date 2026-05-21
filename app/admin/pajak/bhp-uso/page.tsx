import { ensurePermission } from "@/lib/rbac";
import { BhpUsoClient } from "./BhpUsoClient";

export default async function BhpUsoPage() {
  await ensurePermission("tax:read");
  return <BhpUsoClient />;
}
