import { ensureMainTenant } from "@/lib/rbac";
import TenantVpnClient from "./TenantVpnClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantVpnPage({ params }: PageProps) {
  await ensureMainTenant();
  const { id } = await params;
  return <TenantVpnClient tenantId={id} />;
}
