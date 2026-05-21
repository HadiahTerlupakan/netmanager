import { ensureAnyPermission } from "@/lib/rbac";

const TAX_PERMISSIONS = ["tax:read"];

export default async function PajakSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureAnyPermission(TAX_PERMISSIONS);
  return <>{children}</>;
}
