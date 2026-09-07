import { ensureMainTenant } from "@/lib/rbac";
import TenantDomainClient from "./TenantDomainClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantDomainPage({ params }: PageProps) {
  await ensureMainTenant();
  const { id } = await params;
  return <TenantDomainClient tenantId={id} />;
}
