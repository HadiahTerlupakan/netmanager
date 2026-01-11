import { ensurePermission } from '@/lib/rbac'
import CanvasingList from './CanvasingList'

export const metadata = {
    title: 'Canvasing - Admin Portal',
}

export default async function Page() {
    await ensurePermission('canvasing:read')

    return <CanvasingList />
}
