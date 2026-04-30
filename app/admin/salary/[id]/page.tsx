import { notFound } from "next/navigation";
import { getSalaryService, type SalaryRevisionDTO } from "@/modules/salary";
import SalaryDetailClient from "./SalaryDetailClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Detail Gaji | NetManager",
  description: "Detail perhitungan gaji karyawan",
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SalaryDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return null;
  }

  const { id } = await params;
  const salaryService = getSalaryService();
  const salaryResult = await salaryService.getSalaryById(id);

  if (!salaryResult.success || !salaryResult.data) {
    notFound();
  }

  const salary = salaryResult.data;

  // Convert dates to strings for serializing to client component
  const serializedSalary = {
    ...salary,
    createdAt: salary.createdAt.toISOString(),
    updatedAt: salary.updatedAt.toISOString(),
    calculatedAt: salary.calculatedAt?.toISOString() || null,
    auditedAt: salary.auditedAt?.toISOString() || null,
    approvedAt: salary.approvedAt?.toISOString() || null,
    paidAt: salary.paidAt?.toISOString() || null,
    details: salary.details,
    revisions:
      salary.revisions?.map((revision: SalaryRevisionDTO) => ({
        ...revision,
        createdAt: revision.createdAt.toISOString(),
      })) || [],
  };

  return (
    <SalaryDetailClient
      salary={serializedSalary}
      currentUser={{
        id: session.user.id || "",
        name: session.user.name || "",
        role: session.user.role || "",
        // permissions checked in client component via usePermissions hook if needed
      }}
    />
  );
}
