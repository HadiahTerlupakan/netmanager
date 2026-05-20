import { ensurePermission } from "@/lib/rbac";
import SnmpExplorerClient from "./SnmpExplorerClient";

export const dynamic = "force-dynamic";

export default async function SnmpExplorerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission("olt_devices:update");
  const { id } = await params;
  return <SnmpExplorerClient oltId={id} />;
}
