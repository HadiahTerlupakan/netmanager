import { ensurePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OltPage() {
  await ensurePermission("olt:read");
  redirect("/admin/olt/devices");
}
