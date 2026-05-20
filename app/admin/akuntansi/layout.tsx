import { ensureAnyPermission } from "@/lib/rbac";

const ACCOUNTING_PERMISSIONS = ["accounting:read"];

export default async function AkuntansiSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureAnyPermission(ACCOUNTING_PERMISSIONS);
  return <>{children}</>;
}
