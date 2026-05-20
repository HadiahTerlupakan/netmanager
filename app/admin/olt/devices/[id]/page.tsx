import { ensurePermission } from "@/lib/rbac";
import OltDeviceDetailClient from "./OltDeviceDetailClient";

export const dynamic = "force-dynamic";

export default async function OltDeviceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await ensurePermission("olt:read");
  return <OltDeviceDetailClient id={params.id} />;
}
