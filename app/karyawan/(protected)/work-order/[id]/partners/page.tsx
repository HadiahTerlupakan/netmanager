import type { Metadata } from 'next'
import PartnerSelectionClient from './PartnerSelectionClient'

export const metadata: Metadata = {
    title: 'Pilih Partner Kerja',
    description: 'Pilih partner kerja untuk work order ini'
}

export default async function PartnerSelectionPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    return <PartnerSelectionClient id={id} />
}
