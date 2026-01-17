import { ProcurementService } from '@/modules/procurement'
import SupplierForm from '../_components/SupplierForm'
import { notFound } from 'next/navigation'

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
    const service = new ProcurementService()
    const { id } = await params
    const supplier = await service.getSupplierById(id)

    if (!supplier) {
        notFound()
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Supplier</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Edit data supplier {supplier.name}</p>
            </div>
            <SupplierForm initialData={supplier} />
        </div>
    )
}
