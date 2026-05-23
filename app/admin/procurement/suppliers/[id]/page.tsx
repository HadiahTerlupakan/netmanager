import { ensurePermission } from "@/lib/rbac";
import { SupplierEditClient } from "./SupplierEditClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Supplier - Admin Portal",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SupplierDetailPage({ params }: PageProps) {
  await ensurePermission("supplier:read");
  const { id } = await params;
  return <SupplierEditClient supplierId={id} />;
}
