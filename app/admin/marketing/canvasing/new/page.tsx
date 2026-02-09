import { ensurePermission } from '@/lib/rbac'
import CanvasingCreateClient from '@/app/admin/marketing/canvasing/new/CanvasingCreateClient';

export default async function CanvasingCreatePage() {
    await ensurePermission('canvasing:create')
    return <CanvasingCreateClient />;
}
