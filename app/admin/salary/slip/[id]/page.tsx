import { notFound } from "next/navigation";
import { getSalaryService, type SalaryRevisionDTO } from "@/modules/salary";
import SlipPrintClient from "./SlipPrintClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SlipPrintPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return null; // Or redirect
  }

  const { id } = await params;
  const salaryService = getSalaryService();
  const salaryResult = await salaryService.getSalaryById(id);

  if (!salaryResult.success || !salaryResult.data) {
    notFound();
  }

  const salary = salaryResult.data;

  // Convert dates to strings
  const serializedSalary = {
    ...salary,
    createdAt: salary.createdAt.toISOString(),
    updatedAt: salary.updatedAt.toISOString(),
    calculatedAt: salary.calculatedAt?.toISOString() || null,
    auditedAt: salary.auditedAt?.toISOString() || null,
    approvedAt: salary.approvedAt?.toISOString() || null,
    paidAt: salary.paidAt?.toISOString() || null,
    details: salary.details, // No date fields in details
    revisions:
      salary.revisions?.map((revision: SalaryRevisionDTO) => ({
        ...revision,
        createdAt: revision.createdAt.toISOString(),
      })) || [],
  };

  return <SlipPrintClient salary={serializedSalary} />;
}
