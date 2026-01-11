import CanvasingDetailClient from '@/app/admin/marketing/canvasing/[id]/CanvasingDetailClient';

export default async function CanvasingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <CanvasingDetailClient id={id} />;
}
