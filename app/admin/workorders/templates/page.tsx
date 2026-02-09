import { ensureAnyPermission } from '@/lib/rbac'
import TemplatesClient from './TemplatesClient'

export const metadata = {
    title: 'Work Order Templates',
    description: 'Manage work order templates',
}

export default async function TemplatesPage() {
    await ensureAnyPermission(['workorders:read', 'workorder_templates:read'])
    return <TemplatesClient />
}
