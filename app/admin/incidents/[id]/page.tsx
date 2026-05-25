import { ensurePermission } from "@/lib/rbac";
import { IncidentDetailClient } from "./IncidentDetailClient";

export const metadata = {
  title: "Detail Insiden",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission("incidents:read");
  return <IncidentDetailClient params={params} />;
}
