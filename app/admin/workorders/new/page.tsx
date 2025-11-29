"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiArrowLeft } from 'react-icons/hi2'

type Pelanggan = {
    id: string
    idPelanggan: string
    nama: string
}

export default function NewWorkOrderPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [searchingPelanggan, setSearchingPelanggan] = useState(false)
    const [pelangganList, setPelangganList] = useState<Pelanggan[]>([])
    const [searchQuery, setSearchQuery] = useState('')

    const [formData, setFormData] = useState({
        pelangganId: '',
        pelangganDisplay: '',
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
    })

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
        }
    }, [status, router])

    useEffect(() => {
        if (searchQuery.length > 2) {
            searchPelanggan()
        } else {
            setPelangganList([])
        }
    }, [searchQuery])

    const searchPelanggan = async () => {
        setSearchingPelanggan(true)
        try {
            const response = await fetch(`/api/pelanggan?search=${searchQuery}&limit=10`)
            if (response.ok) {
                const result = await response.json()
                setPelangganList(result.data || [])
            }
        } catch (error) {
            console.error('Error searching pelanggan:', error)
        } finally {
            setSearchingPelanggan(false)
        }
    }

    const selectPelanggan = (pelanggan: Pelanggan) => {
        setFormData({
            ...formData,
            pelangganId: pelanggan.id,
            pelangganDisplay: `${pelanggan.nama} (${pelanggan.idPelanggan})`,
            contactName: pelanggan.nama,
        })
        setSearchQuery('')
        setPelangganList([])
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.pelangganId || !formData.title || !formData.description) {
            alert('Please fill in all required fields')
            return
        }

        setLoading(true)

        try {
            const response = await fetch('/api/admin/workorders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pelangganId: formData.pelangganId,
                    type: formData.type,
                    title: formData.title,
                    description: formData.description,
                    priority: formData.priority,
                    locationAddress: formData.locationAddress || undefined,
                    contactName: formData.contactName || undefined,
                    contactPhone: formData.contactPhone || undefined,
                    scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate) : undefined,
                    scheduledTimeStart: formData.scheduledTimeStart || undefined,
                    scheduledTimeEnd: formData.scheduledTimeEnd || undefined,
                }),
            })

            if (response.ok) {
                const result = await response.json()
                alert('Work order created successfully!')
                router.push(`/admin/workorders/${result.data.id}`)
            } else {
                const error = await response.json()
                alert(`Error: ${error.error || 'Failed to create work order'}`)
            }
        } catch (error) {
            console.error('Error creating work order:', error)
            alert('An error occurred')
        } finally {
            setLoading(false)
        }
    }

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Loading...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/workorders/list"
                    className="p-2 hover:bg-gray-100 rounded-lg"
                >
                    <HiArrowLeft className="w-6 h-6" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">New Work Order</h1>
                    <p className="text-gray-600 mt-1">Create a new field work order</p>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-lg shadow">
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Customer Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Customer *
                        </label>
                        {formData.pelangganId ? (
                            <div className="flex items-center justify-between p-3 bg-sky-50 border border-sky-200 rounded-lg">
                                <span className="text-sm font-medium text-gray-900">{formData.pelangganDisplay}</span>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, pelangganId: '', pelangganDisplay: '' })}
                                    className="text-sm text-sky-600 hover:text-sky-700"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search customer by name or ID..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                />
                                {searchingPelanggan && (
                                    <div className="absolute right-3 top-3">
                                        <div className="animate-spin h-4 w-4 border-2 border-sky-500 border-t-transparent rounded-full"></div>
                                    </div>
                                )}
                                {pelangganList.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {pelangganList.map((pelanggan) => (
                                            <button
                                                key={pelanggan.id}
                                                type="button"
                                                onClick={() => selectPelanggan(pelanggan)}
                                                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                                            >
                                                <div className="font-medium text-gray-900">{pelanggan.nama}</div>
                                                <div className="text-sm text-gray-500">{pelanggan.idPelanggan}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Work Order Type & Priority */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Type *
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                required
                            >
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Priority *
                            </label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                required
                            >
                                <option value="LOW">Low</option>
                                <option value="NORMAL">Normal</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                                <option value="CRITICAL">Critical</option>
                            </select>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Title *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g., Koneksi Lambat, Instalasi Baru"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description *
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Detailed description of the work to be done..."
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 resize-none"
                            required
                        />
                    </div>

                    {/* Location & Contact */}
                    <div className="border-t pt-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Location & Contact (Optional)</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Location Address
                                </label>
                                <textarea
                                    value={formData.locationAddress}
                                    onChange={(e) => setFormData({ ...formData, locationAddress: e.target.value })}
                                    placeholder="Full address..."
                                    rows={2}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Contact Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.contactName}
                                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                        placeholder="Contact person name"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Contact Phone
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.contactPhone}
                                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                                        placeholder="0812-xxxx-xxxx"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scheduling */}
                    <div className="border-t pt-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Scheduling (Optional)</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.scheduledDate}
                                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Start Time
                                </label>
                                <input
                                    type="time"
                                    value={formData.scheduledTimeStart}
                                    onChange={(e) => setFormData({ ...formData, scheduledTimeStart: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    End Time
                                </label>
                                <input
                                    type="time"
                                    value={formData.scheduledTimeEnd}
                                    onChange={(e) => setFormData({ ...formData, scheduledTimeEnd: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3 pt-6 border-t">
                        <Link
                            href="/admin/workorders/list"
                            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center font-medium"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={loading || !formData.pelangganId}
                            className="flex-1 px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {loading ? 'Creating...' : 'Create Work Order'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
