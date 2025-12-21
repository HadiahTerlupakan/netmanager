import { PoleForm } from '@/components/pole/PoleForm'

export function ClientComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Pole / Tiang</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Isi data pole/tiang tanpa relasi.</p>
      </div>
      <PoleForm mode="create" />
    </div>
  )
}


