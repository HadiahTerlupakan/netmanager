import { ensurePermission } from '@/lib/rbac'
import SupportContent from './SupportContent'

export const dynamic = 'force-dynamic'

export default async function SupportTicketsPage() {
    await ensurePermission('support:read')

    return <SupportContent />
}
