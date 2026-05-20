import { ensurePermission } from "@/lib/rbac";
import { CoaClient } from "./CoaClient";

export default async function CoaPage() {
  await ensurePermission("accounting:read");
  return <CoaClient />;
}
