import { redirect } from "next/navigation";
import { ensurePermission } from "@/lib/rbac";
import { getFullRadiusMode } from "@/modules/settings";
import AccelPppServerList from "./AccelPppServerList";

export const dynamic = "force-dynamic";

export default async function AccelPppPage() {
  await ensurePermission("accel_ppp:read");
  if (!(await getFullRadiusMode())) {
    redirect("/admin/network/accel-ppp/disabled");
  }
  return <AccelPppServerList />;
}
