import { ensurePermission } from "@/lib/rbac";
import RunDetailClient from "./RunDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: PageProps) {
  await ensurePermission("salary:read");
  const { id } = await params;
  return <RunDetailClient runId={id} />;
}
