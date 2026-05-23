import { ensureMainTenant } from "@/lib/rbac";
import TenantFeaturesClient from "./TenantFeaturesClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantFeaturesPage({ params }: PageProps) {
  await ensureMainTenant();
  const { id } = await params;
  return <TenantFeaturesClient tenantId={id} />;
}
