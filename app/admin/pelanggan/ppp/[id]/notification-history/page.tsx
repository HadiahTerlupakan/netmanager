import { ensureAnyPermission } from "@/lib/rbac";
import NotificationHistoryClient from "./NotificationHistoryClient";

export default async function NotificationHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureAnyPermission(["notifications:read", "pelanggan:read"]);
  const { id } = await params;
  return <NotificationHistoryClient pelangganId={id} />;
}
