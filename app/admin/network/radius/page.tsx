import { ensurePermission } from "@/lib/rbac";
import RadiusDashboard from "./RadiusDashboard";
import { getPppConnectionMode } from "@/modules/settings";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RadiusPage() {
  await ensurePermission("radius:read");

  const connectionMode = await getPppConnectionMode();

  if (connectionMode === "MIKROTIK_API") {
    redirect("/admin/network/mikrotik");
  }

  return <RadiusDashboard />;
}
