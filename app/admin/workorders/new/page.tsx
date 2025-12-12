"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiArrowLeft, HiSparkles, HiBolt, HiUserCircle, HiMagnifyingGlass, HiMapPin, HiWifi, HiClock, HiArchiveBoxArrowDown, HiPlusCircle } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

interface Pelanggan {
    id: string
    idPelanggan: string
    nama: string
    alamat?: string
    noTelp?: string
}

interface Site {
    id: string
    code: string
    name: string
}

export default function NewWorkOrderPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [simpleMode, setSimpleMode] = useState(true)
    const [isGuest, setIsGuest] = useState(true) // Default to Guest Mode

    // Sites state
    const [sites, setSites] = useState<Site[]>([])

    // Search states
    const [searchingPelanggan, setSearchingPelanggan] = useState(false)
    const [pelangganList, setPelangganList] = useState<Pelanggan[]>([])
    const [searchQuery, setSearchQuery] = useState('')

    // Form states
    const [formData, setFormData] = useState({
        pelangganId: '',
        pelangganDisplay: '',
        siteId: '',
        type: 'TROUBLESHOOT',
        title: '',
        description: '',
        priority: 'NORMAL',
        locationAddress: '',
        contactName: '',
        contactPhone: '',
        scheduledDate: '',
        scheduledTimeStart: '',
        scheduledTimeEnd: '',
        disconnectionReason: '',
    })

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login')
        if (status === 'authenticated') fetchSites()
    }, [status, router])

    const fetchSites = async () => {
        try {
            const response = await fetch('/api/admin/sites?activeOnly=true')
            if (response.ok) {
                const result = await response.json()
                setSites(result.data || [])
            }
        } catch (error) {
            console.error('Error fetching sites:', error)
        }
    }

    useEffect(() => {
        let isMounted = true

        const performSearch = async () => {
            if (searchQuery.length > 2 && isMounted) {
                await searchPelanggan()
            } else if (isMounted) {
                setPelangganList([])
            }
        }

        const timeoutId = setTimeout(performSearch, 500) // Debounce

        return () => {
            isMounted = false
            clearTimeout(timeoutId)
        }
    }, [searchQuery])

    const searchPelanggan = async () => {
        setSearchingPelanggan(true)
        try {
            const response = await fetch(`/api/pelanggan?search=${searchQuery}&limit=10`)
            if (response.ok) { const result = await response.json(); setPelangganList(result.data || []) }
        } catch (error) { console.error('Error searching pelanggan:', error) }
        finally { setSearchingPelanggan(false) }
    }

    const selectPelanggan = (p: Pelanggan) => {
        setFormData({
            ...formData,
            pelangganId: p.id,
            pelangganDisplay: `${p.nama} (${p.idPelanggan})`,
            contactName: p.nama,
            contactPhone: p.noTelp || '',
            locationAddress: p.alamat || ''
        })
        setSearchQuery('')
        setPelangganList([])
        setIsGuest(false) // Switch to linked mode
    }

    const handleGuestToggle = () => {
        if (isGuest) {
            // Switching FROM Guest TO Linked
            setFormData(prev => ({ ...prev, pelangganId: '', pelangganDisplay: '' }))
            setIsGuest(false)
        } else {
            // Switching FROM Linked TO Guest
            setIsGuest(true)
            setFormData(prev => ({ ...prev, pelangganId: '', pelangganDisplay: '' }))
        }
    }

    const applyQuickAction = (action: string) => {
        switch (action) {
            case 'INTERNET_MATI':
                setFormData(prev => ({
                    ...prev,
                    title: 'Internet Mati / FOCUT',
                    description: 'Internet mati total, kemungkinan kabel putus atau LOS merah.',
                    type: 'TROUBLESHOOT',
                    priority: 'HIGH',
                    disconnectionReason: ''
                }))
                break;
            case 'WIFI_NO_CONNECT':
                setFormData(prev => ({
                    ...prev,
                    title: 'Tidak Bisa Connect WiFi',
                    description: 'Perangkat tidak bisa terhubung ke WiFi, atau password salah terus.',
                    type: 'TROUBLESHOOT',
                    priority: 'NORMAL',
                    disconnectionReason: ''
                }))
                break;
            case 'LAMBAT':
                setFormData(prev => ({
                    ...prev,
                    title: 'Koneksi Lambat',
                    description: 'Koneksi internet terasa lambat tidak sesuai paket.',
                    type: 'TROUBLESHOOT',
                    priority: 'NORMAL',
                    disconnectionReason: ''
                }))
                break;
            case 'PENARIKAN':
                setFormData(prev => ({
                    ...prev,
                    title: 'Penarikan Perangkat',
                    description: 'Pengambilan perangkat dari lokasi pelanggan (Modem/Router).',
                    type: 'DISCONNECTION',
                    priority: 'NORMAL',
                    disconnectionReason: ''
                }))
                break;
            case 'PASANG_BARU':
                setFormData(prev => ({
                    ...prev,
                    title: 'Instalasi Baru',
                    description: 'Pemasangan perangkat baru untuk pelanggan baru.',
                    type: 'INSTALLATION',
                    priority: 'NORMAL',
                    disconnectionReason: ''
                }))
                break;
            case 'RELOKASI':
                setFormData(prev => ({
                    ...prev,
                    title: 'Relokasi Perangkat',
                    description: 'Pemindahan lokasi perangkat di alamat yang sama atau baru.',
                    type: 'RELOCATION',
                    priority: 'NORMAL',
                    disconnectionReason: ''
                }))
                break;
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        // If Guest mode, only title and description required. If Customer mode, pelangganId required.
        if (!isGuest && !formData.pelangganId) { alert('Please select a customer or switch to Manual Ticket mode'); return }
        if (!formData.title || !formData.description) { alert('Please fill in title and description'); return }
        if (formData.type === 'DISCONNECTION' && !formData.disconnectionReason) { alert('Please select a reason for disconnection'); return }

        setLoading(true)

        // Prepare payload
        const payload = {
            pelangganId: isGuest ? null : formData.pelangganId,
            siteId: formData.siteId || undefined,
            type: formData.type,
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            locationAddress: formData.locationAddress || undefined,
            contactName: formData.contactName || (isGuest ? 'Guest' : undefined),
            contactPhone: formData.contactPhone || undefined,
            scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate) : undefined,
            scheduledTimeStart: formData.scheduledTimeStart || undefined,
            scheduledTimeEnd: formData.scheduledTimeEnd || undefined,
            disconnectionReason: formData.disconnectionReason || undefined,
        }

        try {
            const response = await fetch('/api/admin/workorders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (response.ok) {
                const result = await response.json();
                router.push(`/admin/workorders/${result.data.id}`)
            }
            else {
                const error = await response.json();
                alert(`Error: ${error.error || 'Failed to create work order'}`)
            }
        } catch (error) { console.error('Error creating work order:', error); alert('An error occurred') }
        finally { setLoading(false) }
    }

    if (status === 'loading') return <div className="flex items-center justify-center min-h-screen"><PageLoader /></div>

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/workorders/list" className="p-2 hover:bg-gray-100 rounded-lg"><HiArrowLeft className="w-6 h-6" /></Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">New Work Order</h1>
                        <p className="text-gray-600 mt-1">Ticket Number will be generated automatically</p>
                    </div>
                </div>

                <button
                    onClick={() => setSimpleMode(!simpleMode)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${simpleMode ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    <HiSparkles className="w-4 h-4" />
                    {simpleMode ? 'Simple Mode ON' : 'Simple Mode OFF'}
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 space-y-8">

                    {/* Simplified Contact Section (Default) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-900 uppercase tracking-wide">Customer Details</label>

                            {/* Toggle hidden in "More" or small text if user wants "Simple" */}
                            <button
                                type="button"
                                onClick={handleGuestToggle}
                                className="text-xs text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1"
                            >
                                {isGuest ? <><HiMagnifyingGlass className="w-3 h-3" /> Link to Existing Account</> : 'Switch to Manual Input'}
                            </button>
                        </div>

                        {isGuest ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
                                <div className="md:col-span-2">
                                    <div className="flex items-center gap-2 mb-4 text-gray-500 text-sm">
                                        <HiUserCircle className="w-5 h-5" />
                                        <span>Ordering as Guest / Manual Ticket</span>
                                    </div>
                                </div>

                                <div className='space-y-4'>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Pelanggan <span className='text-red-500'>*</span></label>
                                        <input
                                            type="text"
                                            value={formData.contactName}
                                            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                            placeholder="Nama Lengkap..."
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">No. Telp / WhatsApp</label>
                                        <input
                                            type="tel"
                                            value={formData.contactPhone}
                                            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                                            placeholder="Contoh: 0812..."
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat Lengkap <span className='text-red-500'>*</span></label>
                                    <textarea
                                        value={formData.locationAddress}
                                        onChange={(e) => setFormData({ ...formData, locationAddress: e.target.value })}
                                        placeholder="Jalan, Nomor Rumah, RT/RW, Kelurahan..."
                                        rows={4}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all"
                                        required
                                    />
                                </div>
                            </div>
                        ) : (
                            /* Existing Customer Search Logic */
                            <div className="space-y-4">
                                {formData.pelangganId ? (
                                    <div className="flex items-center justify-between p-4 bg-sky-50 border border-sky-200 rounded-xl">
                                        <div>
                                            <div className="font-semibold text-gray-900">{formData.pelangganDisplay}</div>
                                            <div className="text-sm text-gray-600 mt-0.5">{formData.locationAddress}</div>
                                        </div>
                                        <button type="button" onClick={() => setFormData({ ...formData, pelangganId: '', pelangganDisplay: '' })} className="text-sm font-medium text-sky-600 hover:text-sky-700 px-3 py-1.5 hover:bg-sky-100 rounded-lg transition-colors">Change</button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search customer by name or ID..."
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
                                            autoFocus
                                        />
                                        {searchingPelanggan && <div className="absolute right-4 top-3.5"><div className="animate-spin h-5 w-5 border-2 border-sky-500 border-t-transparent rounded-full"></div></div>}
                                        {pelangganList.length > 0 && (
                                            <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                                {pelangganList.map((p) => (
                                                    <button key={p.id} type="button" onClick={() => selectPelanggan(p)} className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors">
                                                        <div className="font-medium text-gray-900">{p.nama}</div>
                                                        <div className="text-sm text-gray-500 flex justify-between">
                                                            <span>{p.idPelanggan}</span>
                                                            <span>{p.alamat}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions (Only in Simple Mode) */}
                    {simpleMode && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">Quick Actions (Issues)</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                <button type="button" onClick={() => applyQuickAction('INTERNET_MATI')} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all group">
                                    <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform"><HiWifi className="w-6 h-6" /></div>
                                    <span className="text-xs font-medium text-gray-700 group-hover:text-red-700 text-center">Internet Mati / FOCUT</span>
                                </button>
                                <button type="button" onClick={() => applyQuickAction('LAMBAT')} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all group">
                                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform"><HiClock className="w-6 h-6" /></div>
                                    <span className="text-xs font-medium text-gray-700 group-hover:text-orange-700 text-center">Koneksi Lambat</span>
                                </button>
                                <button type="button" onClick={() => applyQuickAction('PENARIKAN')} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all group">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center group-hover:scale-110 transition-transform"><HiArchiveBoxArrowDown className="w-6 h-6" /></div>
                                    <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900 text-center">Penarikan Perangkat</span>
                                </button>
                                <button type="button" onClick={() => applyQuickAction('PASANG_BARU')} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all group">
                                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform"><HiPlusCircle className="w-6 h-6" /></div>
                                    <span className="text-xs font-medium text-gray-700 group-hover:text-green-700 text-center">Pasang Baru</span>
                                </button>
                                <button type="button" onClick={() => applyQuickAction('RELOKASI')} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform"><HiMapPin className="w-6 h-6" /></div>
                                    <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700 text-center">Relokasi Perangkat</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Site Selection */}
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-900 uppercase tracking-wide">Site / Area</label>
                        <select
                            value={formData.siteId}
                            onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
                        >
                            <option value="">Select Site (optional)</option>
                            {sites.map((site) => (
                                <option key={site.id} value={site.id}>
                                    {site.code} - {site.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500">Work order will be available to employees assigned to this site</p>
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Title <span className='text-red-500'>*</span></label>
                                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., Koneksi Lambat" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Priority <span className='text-red-500'>*</span></label>
                                <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500" required>
                                    <option value="LOW">Low</option>
                                    <option value="NORMAL">Normal</option>
                                    <option value="HIGH">High</option>
                                    <option value="URGENT">Urgent</option>
                                    <option value="CRITICAL">Critical</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Description <span className='text-red-500'>*</span></label>
                            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Detailed description..." rows={5} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 resize-none" required />
                        </div>
                    </div>

                    {/* Disconnection Reason Dropdown */}
                    {(formData.type === 'DISCONNECTION' || formData.title.includes('Penarikan Perangkat')) && (
                        <div className="space-y-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <label className="block text-sm font-medium text-red-900">Alasan Penarikan <span className='text-red-500'>*</span></label>
                            <select
                                value={formData.disconnectionReason}
                                onChange={(e) => setFormData({ ...formData, disconnectionReason: e.target.value })}
                                className="w-full px-4 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 text-gray-900"
                                required={formData.type === 'DISCONNECTION'}
                            >
                                <option value="">Pilih Alasan...</option>
                                <option value="Telat Bayar">Telat Bayar</option>
                                <option value="Pindah Rumah">Pindah Rumah</option>
                                <option value="Pindah ke Provider Lain">Pindah ke Provider Lain</option>
                                <option value="Sering Gangguan">Sering Gangguan</option>
                                <option value="Pelayanan Pelanggan Buruk">Pelayanan Pelanggan Buruk</option>
                                <option value="Kebutuhan Menurun">Kebutuhan Menurun</option>
                                <option value="Harga Terlalu Mahal">Harga Terlalu Mahal</option>
                                <option value="Kecepatan Tidak Sesuai Janji">Kecepatan Tidak Sesuai Janji</option>
                                <option value="Tidak Ada Keterangan">Tidak Ada Keterangan</option>
                            </select>
                        </div>
                    )}

                    {/* Detailed Actions (Hidden in Simple Mode) */}
                    <div className={`space-y-6 pt-6 border-t border-gray-100 ${simpleMode ? 'hidden' : 'block'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Request Type <span className='text-red-500'>*</span></label>
                                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500" required>
                                    <option value="INSTALLATION">Installation</option>
                                    <option value="TROUBLESHOOT">Troubleshoot</option>
                                    <option value="MAINTENANCE">Maintenance</option>
                                    <option value="UPGRADE">Upgrade</option>
                                    <option value="RELOCATION">Relocation</option>
                                    <option value="DISCONNECTION">Disconnection</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Date</label>
                                <input type="date" value={formData.scheduledDate} onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500" />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Link href="/admin/workorders/list" className="flex-1 px-6 py-3.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-center font-medium transition-colors">Cancel</Link>
                        <button type="submit" disabled={loading} className="flex-[2] px-6 py-3.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-sky-200 transition-all hover:shadow-xl hover:-translate-y-0.5">{loading ? 'Creating...' : 'Create Work Order'}</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
