import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from '@/app/admin/settings/roles/[id]/RolesDetailClient'

export default async function PengaturanHakAksesDetailPage() {
  await ensurePermission('roles:read')
  return <ClientComponent />
}
