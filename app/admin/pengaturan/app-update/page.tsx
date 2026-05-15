import { ensurePermission, ensureMainTenant } from "@/lib/rbac";

import { AppUpdateClient } from "./AppUpdateClient";

export default async function AppUpdatePage() {
  await ensureMainTenant();
  await ensurePermission("app_version:read");
  return <AppUpdateClient />;
}
