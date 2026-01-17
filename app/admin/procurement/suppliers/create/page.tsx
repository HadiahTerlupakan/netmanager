"use client"

import SupplierForm from '../_components/SupplierForm'

export default function CreateSupplierPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tambah Supplier</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Buat data supplier baru</p>
            </div>
            <SupplierForm />
        </div>
    )
}
