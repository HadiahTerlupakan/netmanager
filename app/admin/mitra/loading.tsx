'use client'

export const dynamic = 'force-dynamic'

export default function MitraLoadingPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-500 animate-pulse">Memuat data mitra...</p>
        </div>
    )
}
