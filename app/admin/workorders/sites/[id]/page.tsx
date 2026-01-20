import { SiteDetailClient } from './SiteDetailClient'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function SiteDetailPage({ params }: PageProps) {
    const { id } = await params
    return <SiteDetailClient siteId={id} />
}
