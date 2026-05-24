import { redirect } from "next/navigation";
import { ensurePermission } from "@/lib/rbac";
import { getFullRadiusMode } from "@/modules/settings";
import AccelPppServerDetail from "./AccelPppServerDetail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AccelPppDetailPage({ params }: PageProps) {
  await ensurePermission("accel_ppp:read");
  if (!(await getFullRadiusMode())) {
    redirect("/admin/network/accel-ppp/disabled");
  }
  const { id } = await params;
  return <AccelPppServerDetail id={id} />;
}
