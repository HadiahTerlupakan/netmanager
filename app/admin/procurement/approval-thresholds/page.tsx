import { ensurePermission } from "@/lib/rbac";
import { ApprovalThresholdClient } from "./ApprovalThresholdClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Approval Threshold - Admin Portal",
};

export default async function ApprovalThresholdPage() {
  await ensurePermission("procurement:read");
  return <ApprovalThresholdClient />;
}
