import { ensureAnyPermission } from "@/lib/rbac";

// Work Orders section permissions
const WORKORDERS_PERMISSIONS = [
  "workorders:read",
  "work_order_dashboard:read",
  "site:read",
  "department:read",
];

export default async function WorkordersSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureAnyPermission(WORKORDERS_PERMISSIONS);
  return <>{children}</>;
}
