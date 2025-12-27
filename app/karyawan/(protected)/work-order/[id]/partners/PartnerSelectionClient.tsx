'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MdArrowBack, MdCheck, MdPerson, MdSave } from 'react-icons/md'

interface User {
    id: string
    name: string
    role?: { name: string }
}

export default function PartnerSelectionClient({ id }: { id: string }) {
    const router = useRouter()
    const [partners, setPartners] = useState<User[]>([])
    const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [siteFilter, setSiteFilter] = useState<string>('all')
    const [availableSites, setAvailableSites] = useState<{ id: string, name: string }[]>([])

    useEffect(() => {
        fetchData()
    }, [id])

    const fetchData = async () => {
        try {
            // Fetch eligible partners
            let availablePartners: User[] = []
            const partnersRes = await fetch(`/api/karyawan/users/partners?workOrderId=${id}`)
            if (partnersRes.ok) {
                const data = await partnersRes.json()
                const users = data.users || []
                setPartners(users)

                // Extract unique sites from users
                const sites = users.reduce((acc: any[], user: any) => {
                    if (user.sites && !acc.find((s: any) => s.id === user.sites.id)) {
                        acc.push(user.sites)
                    }
                    return acc
                }, [])
                setAvailableSites(sites.sort((a: any, b: any) => a.name.localeCompare(b.name)))
            }

            // Fetch current assignments to pre-select
            const woRes = await fetch(`/api/karyawan/work-order/${id}`)
            if (woRes.ok) {
                const data = await woRes.json()
                const currentPartners = data.workOrder.assignments
                    ?.filter((a: any) => a.role === 'PARTNER')
                    .map((a: any) => a.user.id) || []

                // Only select partners that are currently valid/eligible
                // This prevents "phantom" invalid partners from blocking the save
                const validCurrentPartners = currentPartners.filter((id: string) =>
                    availablePartners.some(p => p.id === id)
                )

                setSelectedPartnerIds(validCurrentPartners)
            }
        } catch (error) {
            console.error('Failed to fetch data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const togglePartner = (partnerId: string) => {
        setSelectedPartnerIds(prev =>
            prev.includes(partnerId)
                ? prev.filter(p => p !== partnerId)
                : [...prev, partnerId]
        )
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const res = await fetch(`/api/karyawan/work-order/${id}/partners`, {
                method: 'POST', // or PUT
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerIds: selectedPartnerIds })
            })

            if (res.ok) {
                router.push(`/karyawan/work-order/${id}`)
                router.refresh()
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal menyimpan partner')
            }
        } catch (error) {
            console.error('Error saving partners:', error)
            alert('Terjadi kesalahan')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased">
            <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">

                {/* Header */}
                <div className="sticky top-0 z-20 bg-[#f6f7f8] dark:bg-[#101922] border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center p-4 justify-between">
                        <Link href={`/karyawan/work-order/${id}`} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <MdArrowBack className="text-2xl" />
                        </Link>
                        <div className="flex-1 text-center">
                            <h2 className="text-sm font-bold leading-tight">Pilih Partner Kerja</h2>
                        </div>
                    </div>

                    {/* Filter */}
                    <div className="px-4 pb-4">
                        <select
                            value={siteFilter}
                            onChange={(e) => setSiteFilter(e.target.value)}
                            className="w-full p-2 rounded-lg bg-white dark:bg-[#1c2936] border border-gray-200 dark:border-gray-800 text-sm"
                        >
                            <option value="all">Semua Site</option>
                            {availableSites.map(site => (
                                <option key={site.id} value={site.id}>{site.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 space-y-4">
                    <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Pilih rekan kerja yang akan membantu Anda dalam Work Order ini.
                        </p>

                        {partners.length > 0 ? (
                            <div className="space-y-2">
                                {partners
                                    .filter(p => siteFilter === 'all' || (p as any).site?.id === siteFilter)
                                    .map(partner => (
                                        <div
                                            key={partner.id}
                                            onClick={() => togglePartner(partner.id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedPartnerIds.includes(partner.id)
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${selectedPartnerIds.includes(partner.id)
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                                                }`}>
                                                {selectedPartnerIds.includes(partner.id) && <MdCheck className="text-sm" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium dark:text-white">{partner.name}</p>
                                                {partner.role?.name && (
                                                    <p className="text-xs text-gray-500">{partner.role.name}</p>
                                                )}
                                                {(partner as any).sites?.name && (
                                                    <p className="text-xs text-blue-500 dark:text-blue-400">{(partner as any).sites.name}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <MdPerson className="text-4xl text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">Tidak ada partner tersedia di site Anda.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="fixed bottom-24 left-0 right-0 p-4 bg-[#f6f7f8] dark:bg-[#101922] border-t border-gray-100 dark:border-gray-800 max-w-md mx-auto z-50">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <MdCheck className="text-xl" />
                                Selesai Tambah Partner
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
