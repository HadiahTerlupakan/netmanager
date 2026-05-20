import { ensurePermission } from "@/lib/rbac";
import VlanConfigClient from "./VlanConfigClient";

export const dynamic = "force-dynamic";

export default async function VlanConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission("olt_vlan:read");
  const { id } = await params;
  return <VlanConfigClient oltId={id} />;
}
