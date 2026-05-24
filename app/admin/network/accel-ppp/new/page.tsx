import { redirect } from "next/navigation";
import { ensurePermission } from "@/lib/rbac";
import { getFullRadiusMode } from "@/modules/settings";
import AccelPppServerForm from "../AccelPppServerForm";

export const dynamic = "force-dynamic";

export default async function NewAccelPppPage() {
  await ensurePermission("accel_ppp:create");
  if (!(await getFullRadiusMode())) {
    redirect("/admin/network/accel-ppp/disabled");
  }
  return <AccelPppServerForm mode="create" />;
}
