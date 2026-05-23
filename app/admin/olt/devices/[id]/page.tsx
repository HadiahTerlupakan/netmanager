import { ensurePermission } from "@/lib/rbac";
import OltDeviceDetailClient from "./OltDeviceDetailClient";

export const dynamic = "force-dynamic";

export default async function OltDeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission("olt:read");
  const { id } = await params;
  return <OltDeviceDetailClient id={id} />;
}
