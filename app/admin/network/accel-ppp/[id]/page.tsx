import { ensurePermission } from "@/lib/rbac";
import AccelPppServerDetail from "./AccelPppServerDetail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AccelPppDetailPage({ params }: PageProps) {
  await ensurePermission("accel_ppp:read");
  const { id } = await params;
  return <AccelPppServerDetail id={id} />;
}
