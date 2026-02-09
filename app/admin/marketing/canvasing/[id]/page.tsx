import { ensurePermission } from '@/lib/rbac'
import CanvasingDetailClient from '@/app/admin/marketing/canvasing/[id]/CanvasingDetailClient';

export default async function CanvasingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('canvasing:read')
    const { id } = await params;
    return <CanvasingDetailClient id={id} />;
}
