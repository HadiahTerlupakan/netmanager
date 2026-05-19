import { ensurePermission } from "@/lib/rbac";
import { EditAnnouncementContent } from "./EditAnnouncementContent";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission("announcement:read");
  return <EditAnnouncementContent params={params} />;
}
