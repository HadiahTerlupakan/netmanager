import type { Metadata } from 'next'
import SalesListClient from './SalesListClient'

export const metadata: Metadata = {
    title: 'Manajemen Sales | NetManager',
    description: 'Kelola tim sales dan target canvasing',
}

export default async function SalesPage() {
    return (
        <div className="p-6 max-w-7xl mx-auto">
            <SalesListClient />
        </div>
    )
}
