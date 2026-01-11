import SalesDetailClient from './SalesDetailClient'

export default async function SalesDetailPage({ params }: { params: Promise<{ id: string }> }) {
    return (
        <div className="p-6">
            <SalesDetailClient params={params} />
        </div>
    )
}
