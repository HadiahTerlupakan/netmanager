import { ensurePermission } from '@/lib/rbac'
import CanvasingEditClient from '@/app/admin/marketing/canvasing/[id]/edit/CanvasingEditClient';

export default async function CanvasingEditPage({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('canvasing:update')
    const { id } = await params;
    return <CanvasingEditClient id={id} />;
}
