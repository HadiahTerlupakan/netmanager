'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PengaturanPage() {
    const router = useRouter()

    useEffect(() => {
        // Redirect ke halaman pengaturan umum
        router.replace('/admin/pengaturan/umum')
    }, [router])

    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Mengalihkan ke pengaturan...</p>
            </div>
        </div>
    )
}
