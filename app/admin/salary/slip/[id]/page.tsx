
import { notFound } from 'next/navigation'
// Force rebuild
import { SalaryRepository } from '@/modules/salary/repositories/SalaryRepository'
import SlipPrintClient from './SlipPrintClient'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface PageProps {
    params: Promise<{
        id: string
    }>
}

export default async function SlipPrintPage({ params }: PageProps) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return null // Or redirect
    }

    const { id } = await params
    const salaryRepo = new SalaryRepository()
    const salary = await salaryRepo.findById(id)

    if (!salary) {
        notFound()
    }

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
        revisions: salary.revisions?.map(r => ({
            ...r,
            createdAt: r.createdAt.toISOString()
        })) || []
    }

    return <SlipPrintClient salary={serializedSalary} />
}
