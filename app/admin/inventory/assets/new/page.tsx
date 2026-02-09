import { ensurePermission } from '@/lib/rbac'
import { CreateAssetForm } from '@/components/inventory/assets/CreateAssetForm'

export default async function NewAssetPage() {
  await ensurePermission('asset:create')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Registrasi Aset Baru
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Tambahkan aset tetap baru ke dalam inventaris
        </p>
      </div>

      <CreateAssetForm />
    </div>
  )
}
