import { ensurePermission } from "@/lib/rbac";
import { FeatureFlagsHubClient } from "./FeatureFlagsHubClient";

export const metadata = {
  title: "Feature Flags",
  description: "Kelola feature flag per tenant",
};

export default async function Page() {
  await ensurePermission("tenants:read");
  return <FeatureFlagsHubClient />;
}
