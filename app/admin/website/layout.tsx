import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, isSuperAdmin } from "@/lib/auth";

/**
 * Server-side guard for /admin/website/* pages.
 * Only super admins are allowed to manage landing page content.
 * Non-super-admins are redirected to the admin dashboard with an error flag.
 */
export default async function WebsiteAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/admin/login");
  }

  if (!isSuperAdmin(session.user)) {
    redirect("/admin?error=SuperAdminOnly");
  }

  return <>{children}</>;
}
