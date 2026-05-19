import { ensurePermission } from "@/lib/rbac";
import { SupportDetailClient } from "./SupportDetailClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission("support:read");
  const { id } = await params;
  return <SupportDetailClient key={id} />;
}
