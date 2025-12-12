'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiOutlineArrowLeft,
    HiOutlinePencil,
    HiOutlineEnvelope,
    HiOutlinePhone,
    HiOutlineBuildingOffice,
    HiOutlineBriefcase,
    HiOutlineCalendar,
    HiOutlineBanknotes,
    HiOutlineMapPin
} from 'react-icons/hi2'

interface Employee {
    id: string
    employeeId: string
    fullName: string
    email: string | null
    phone: string | null
    dateOfBirth: string | null
    gender: string | null
    idCardNumber: string | null
    address: string | null
    city: string | null
    province: string | null
    employmentStatus: string
    joinDate: string
    probationEndDate: string | null
    bankName: string | null
    bankAccountNumber: string | null
    bankAccountName: string | null
    npwp: string | null
    emergencyName: string | null
    emergencyPhone: string | null
    emergencyRelation: string | null
    isActive: boolean
    department?: { id: string; name: string } | null
    site?: { id: string; code: string; name: string } | null
    position?: { id: string; title: string; level: string | null } | null
}

export default function EmployeeDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [employee, setEmployee] = useState<Employee | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (params.id) {
            fetchEmployee()
        }
    }, [params.id])

    const fetchEmployee = async () => {
        try {
            const res = await fetch(`/api/hris/employees/${params.id}`)
            const data = await res.json()

            if (res.ok) {
                setEmployee(data)
            } else {
                alert('Employee not found')
                router.push('/admin/hris/employees')
            }
        } catch (error) {
            console.error('Error fetching employee:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            PERMANENT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            PROBATION: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            CONTRACT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            INTERNSHIP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
            TERMINATED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        }

        return (
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
                {status}
            </span>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    if (!employee) {
        return <div>Employee not found</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/hris/employees"
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                        <HiOutlineArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{employee.fullName}</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {employee.employeeId}
                        </p>
                    </div>
                </div>
                <Link
                    href={`/admin/hris/employees/${employee.id}/edit`}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                    <HiOutlinePencil className="w-5 h-5" />
                    Edit
                </Link>
            </div>

            {/* Status Badge */}
            <div>
                {getStatusBadge(employee.employmentStatus)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Personal Information */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Personal Information
                        </h2>
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                    <HiOutlineEnvelope className="w-4 h-4" />
                                    {employee.email || '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                    <HiOutlinePhone className="w-4 h-4" />
                                    {employee.phone || '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Date of Birth</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('id-ID') : '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Gender</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.gender || '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ID Card Number</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.idCardNumber || '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">NPWP</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.npwp || '-'}
                                </dd>
                            </div>
                            <div className="md:col-span-2">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.address || '-'}
                                    {employee.city && `, ${employee.city}`}
                                    {employee.province && `, ${employee.province}`}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* Employment Information */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Employment Information
                        </h2>
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Department</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                    <HiOutlineBuildingOffice className="w-4 h-4" />
                                    {employee.department?.name || '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Position</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                    <HiOutlineBriefcase className="w-4 h-4" />
                                    {employee.position?.title || '-'}
                                    {employee.position?.level && ` (${employee.position.level})`}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Site / Area</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                    <HiOutlineMapPin className="w-4 h-4" />
                                    {employee.site ? `${employee.site.code} - ${employee.site.name}` : '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Join Date</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                    <HiOutlineCalendar className="w-4 h-4" />
                                    {new Date(employee.joinDate).toLocaleDateString('id-ID')}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Probation End</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.probationEndDate
                                        ? new Date(employee.probationEndDate).toLocaleDateString('id-ID')
                                        : '-'}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* Bank Information */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <HiOutlineBanknotes className="w-5 h-5" />
                            Bank Information
                        </h2>
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Bank Name</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.bankName || '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Number</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.bankAccountNumber || '-'}
                                </dd>
                            </div>
                            <div className="md:col-span-2">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Name</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.bankAccountName || '-'}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Emergency Contact */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Emergency Contact
                        </h2>
                        <dl className="space-y-4">
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.emergencyName || '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.emergencyPhone || '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Relation</dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                    {employee.emergencyRelation || '-'}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Quick Actions
                        </h2>
                        <div className="space-y-2">
                            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors">
                                View Attendance
                            </button>
                            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors">
                                View Leave Requests
                            </button>
                            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors">
                                View Payslips
                            </button>
                            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors">
                                Upload Documents
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
