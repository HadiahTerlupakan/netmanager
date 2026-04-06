export const dynamic = 'force-dynamic'

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from '@/app/admin/settings/roles/RolesClient'

export default async function PengaturanHakAksesPage() {
  await ensurePermission('roles:read')
  return <ClientComponent />
}
