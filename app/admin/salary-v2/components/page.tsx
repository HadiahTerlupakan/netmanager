import { ensurePermission } from "@/lib/rbac";
import ComponentsClient from "./ComponentsClient";

export default async function ComponentsPage() {
  await ensurePermission("salary:read");
  return <ComponentsClient />;
}
