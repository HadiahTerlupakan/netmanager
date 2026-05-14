import { ensurePermission } from "@/lib/rbac";
import { GudangEditClient } from "./GudangEditClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePermission("gudang:update");
  return <GudangEditClient params={params} />;
}
