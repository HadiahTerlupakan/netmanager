'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
    MdRefresh,
    MdSearch,
    MdFilterList,
    MdPublic,
    MdVisibility,
    MdAccessTime,
    MdVerified,
    MdBlock,
    MdConstruction,
    MdInstallDesktop,
    MdCancel
} from 'react-icons/md'

interface Registration {
    id: string
    name: string
    email: string
    phone: string
    address: string
    location: string | null
    packageName: string | null
    ipAddress: string | null
    status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SURVEYED' | 'INSTALLED' | 'CANCELLED'
    notes: string | null
    createdAt: string
}

interface IpInfo {
    ip: string
    country: string
    countryCode: string
    isp: string
    city?: string
}

const STATUS_OPTIONS = [
    { value: '', label: 'Semua Status' },
    { value: 'PENDING', label: 'Menunggu' },
    { value: 'VERIFIED', label: 'Terverifikasi' },
    { value: 'REJECTED', label: 'Ditolak' },
    { value: 'SURVEYED', label: 'Sudah Survei' },
    { value: 'INSTALLED', label: 'Terinstal' },
    { value: 'CANCELLED', label: 'Dibatalkan' }
]

export default function AdminRegistrationsPage() {
    const [registrations, setRegistrations] = useState<Registration[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [ipInfoCache, setIpInfoCache] = useState<Record<string, IpInfo>>({})

    const fetchRegistrations = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/admin/registrations')
            if (res.ok) {
                const data = await res.json()
                setRegistrations(data)

                // Fetch IP info for each unique IP
                const uniqueIps = [...new Set(data.map((r: Registration) => r.ipAddress).filter(Boolean))] as string[]
                uniqueIps.forEach(ip => {
                    if (!ipInfoCache[ip]) {
                        fetchIpInfo(ip)
                    }
                })
            }
        } catch (error) {
            console.error('Failed to fetch registrations', error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchIpInfo = async (ip: string) => {
        try {
            const res = await fetch(`/api/ip-info?ip=${encodeURIComponent(ip)}`)
            if (res.ok) {
                const data = await res.json()
                setIpInfoCache(prev => ({ ...prev, [ip]: data }))
            }
        } catch (e) {
            console.error('Failed to fetch IP info', e)
        }
    }

    useEffect(() => {
        fetchRegistrations()
    }, [])

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'PENDING':
                return { color: 'bg-yellow-100 text-yellow-800', icon: MdAccessTime, label: 'Menunggu' }
            case 'VERIFIED':
                return { color: 'bg-blue-100 text-blue-800', icon: MdVerified, label: 'Terverifikasi' }
            case 'REJECTED':
                return { color: 'bg-red-100 text-red-800', icon: MdBlock, label: 'Ditolak' }
            case 'SURVEYED':
                return { color: 'bg-purple-100 text-purple-800', icon: MdConstruction, label: 'Sudah Survei' }
            case 'INSTALLED':
                return { color: 'bg-green-100 text-green-800', icon: MdInstallDesktop, label: 'Terinstal' }
            case 'CANCELLED':
                return { color: 'bg-gray-100 text-gray-800', icon: MdCancel, label: 'Dibatalkan' }
            default:
                return { color: 'bg-gray-100 text-gray-800', icon: MdAccessTime, label: status }
        }
    }

    const filteredRegistrations = registrations.filter(reg => {
        const matchesSearch =
            reg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.phone.includes(searchTerm)

        const matchesStatus = !statusFilter || reg.status === statusFilter

        return matchesSearch && matchesStatus
    })

    // Count by status
    const statusCounts = registrations.reduce((acc, reg) => {
        acc[reg.status] = (acc[reg.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pendaftaran Pelanggan</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Total: {registrations.length} |
                        Pending: {statusCounts['PENDING'] || 0} |
                        Verified: {statusCounts['VERIFIED'] || 0}
                    </p>
                </div>
                <button
                    onClick={fetchRegistrations}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                    <MdRefresh /> Refresh
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Filters */}
                <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
                        <input
                            type="text"
                            placeholder="Cari nama, email, atau telepon..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative min-w-[180px]">
                        <MdFilterList className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                        >
                            {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
                                <th className="p-4 font-semibold border-b border-slate-200">Tanggal</th>
                                <th className="p-4 font-semibold border-b border-slate-200">Nama</th>
                                <th className="p-4 font-semibold border-b border-slate-200">Kontak</th>
                                <th className="p-4 font-semibold border-b border-slate-200">Area / Lokasi</th>
                                <th className="p-4 font-semibold border-b border-slate-200">Paket</th>
                                <th className="p-4 font-semibold border-b border-slate-200">IP Address</th>
                                <th className="p-4 font-semibold border-b border-slate-200">Status</th>
                                <th className="p-4 font-semibold border-b border-slate-200">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-500">Memuat data...</td>
                                </tr>
                            ) : filteredRegistrations.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-500">
                                        {searchTerm || statusFilter ? 'Tidak ada data yang cocok dengan filter.' : 'Belum ada data pendaftaran.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredRegistrations.map((reg) => {
                                    const ipInfo = reg.ipAddress ? ipInfoCache[reg.ipAddress] : null
                                    const statusConfig = getStatusConfig(reg.status)
                                    const StatusIcon = statusConfig.icon

                                    return (
                                        <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 whitespace-nowrap">
                                                {new Date(reg.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                <div className="text-xs text-slate-400">
                                                    {new Date(reg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="p-4 font-medium text-slate-900">{reg.name}</td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span>{reg.phone}</span>
                                                    <span className="text-slate-400 text-xs">{reg.email}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">{reg.location || '-'}</td>
                                            <td className="p-4">
                                                {reg.packageName ? (
                                                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                                                        {reg.packageName}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">-</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {reg.ipAddress ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-xs">{reg.ipAddress}</span>
                                                        {ipInfo ? (
                                                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                                                <MdPublic className="text-slate-400" />
                                                                <span>{ipInfo.country} • {ipInfo.isp}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">Loading...</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">-</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${statusConfig.color}`}>
                                                    <StatusIcon className="text-sm" />
                                                    {statusConfig.label}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <Link
                                                    href={`/admin/registrations/${reg.id}`}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                                                >
                                                    <MdVisibility /> Detail
                                                </Link>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
