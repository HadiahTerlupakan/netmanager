"use client"
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useSession } from 'next-auth/react'
import {
  HiOutlineArrowLeft,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineKey,
  HiOutlineUserCircle,
  HiOutlineBuildingOffice,
  HiOutlinePhone,
  HiOutlineUser,
  HiOutlineEnvelope,
  HiOutlineMap,
  HiOutlineCheckCircle,
  HiOutlineShieldCheck,
  HiOutlineExclamationTriangle,
  HiArrowPath,
  HiOutlineIdentification,
  HiOutlineStar
} from 'react-icons/hi2'
import WorkingHoursSettings from './WorkingHoursSettings'
import UserPerformanceStats from './UserPerformanceStats'
import SalesPerformanceStats from './SalesPerformanceStats'
import MultiSiteSelect from '../components/MultiSiteSelect'

interface SelectedSite {
  siteId: string
  isPrimary: boolean
}

interface Department {
  id: string
  name: string
}

interface Role {
  id: string
  name: string
  description?: string
}

interface Site {
  id: string
  code: string
  name: string
}

interface UserData {
  id: string
  email: string
  name: string | null
  phone: string | null
  departmentId: string | null
  siteId: string | null
  roleId?: string | null
  isActive: boolean
  department?: { name: string } | null
  departments?: { name: string } | null
  site?: { code: string; name: string } | null
  sites?: { code: string; name: string } | null
  role?: { name: string } | null
  // Multi-site support
  userSites?: Array<{
    id: string
    siteId: string
    isPrimary: boolean
    site: { id: string; code: string; name: string }
  }>
  // Working hours
  workingHourMode?: string
  startWorkTime?: string | null
  endWorkTime?: string | null
  workDays?: string | null
  flexibleTargetHour?: number | null
  shiftId?: string | null
  canvasingTarget?: number
  isSales?: boolean
}

export function ClientComponent({ params, searchParams }: { params: Promise<{ id: string }>, searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const searchParamsValue = use(searchParams || Promise.resolve({} as { [key: string]: string | string[] | undefined }))
  const isViewMode = searchParamsValue['view'] === 'true'

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [selectedSites, setSelectedSites] = useState<SelectedSite[]>([])

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    departmentId: '',
    siteId: '',
    roleId: '',
    isActive: true,
    // Working Hours
    workingHourMode: 'FIXED',
    startWorkTime: '',
    endWorkTime: '',
    workDays: '',
    flexibleTargetHour: 8,
    shiftId: '',
    isSales: false
  })

  useEffect(() => {
    Promise.all([
      fetchUser(),
      fetchDepartments(),
      fetchRoles(),
      fetchSites(),
    ]).finally(() => setLoading(false))
  }, [id])

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/admin/departments')
      if (res.status === 403) return // Ignore forbidden
      const data = await res.json()
      if (res.ok) {
        setDepartments(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles')
      if (res.status === 403) return // Ignore forbidden
      const data = await res.json()
      if (res.ok) {
        setRoles(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching roles:', error)
    }
  }

  const fetchSites = async () => {
    try {
      const res = await fetch('/api/admin/sites?activeOnly=true')
      if (res.status === 403) return // Ignore forbidden
      const data = await res.json()
      if (res.ok) {
        setSites(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching sites:', error)
    }
  }

  const fetchUser = async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}`)
      const data = await res.json()
      const usr = data.user

      if (usr) {
        setUser(usr)
        setFormData({
          name: usr.name || '',
          phone: usr.phone || '',
          password: '',
          departmentId: usr.departmentId || '',
          siteId: usr.siteId || '',
          roleId: usr.roleId || '',
          isActive: usr.isActive ?? true,
          // Working Hours
          workingHourMode: usr.workingHourMode || 'FIXED',
          startWorkTime: usr.startWorkTime || '',
          endWorkTime: usr.endWorkTime || '',
          workDays: usr.workDays || '',
          flexibleTargetHour: usr.flexibleTargetHour || 8,
          shiftId: usr.shiftId || '',
          isSales: usr.isSales || false
        })
        // Multi-site: Load userSites
        if (usr.userSites && usr.userSites.length > 0) {
          setSelectedSites(usr.userSites.map((us: any) => ({
            siteId: us.siteId,
            isPrimary: us.isPrimary
          })))
        } else if (usr.siteId) {
          // Fallback: convert legacy siteId to multi-site format
          setSelectedSites([{ siteId: usr.siteId, isPrimary: true }])
        }
      }
    } catch (error: any) {
      console.error('Error fetching user:', error)
      toast.error('Gagal memuat data user: ' + (error.message || 'Unknown error'))
      setErrors({ fetch: error.message || 'Gagal memuat data' })
    }
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, password }))
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors.password
      return newErrors
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))

    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name) {
      newErrors.name = 'Nama wajib diisi'
    }

    if (!formData.roleId) {
      newErrors.roleId = 'Peran pengguna wajib dipilih'
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password minimal 6 karakter jika diisi'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSubmitting(true)

    try {
      const updateBody: Record<string, unknown> = {
        name: formData.name,
        phone: formData.phone || null,
        departmentId: formData.departmentId || null,
        roleId: formData.roleId,
        isActive: formData.isActive,
        // Working Hours
        workingHourMode: formData.workingHourMode,
        startWorkTime: formData.startWorkTime || null,
        endWorkTime: formData.endWorkTime || null,
        workDays: formData.workDays || null,
        flexibleTargetHour: formData.flexibleTargetHour || null,
        shiftId: formData.shiftId || null,
        isSales: formData.isSales,
        // Multi-site support
        userSites: selectedSites,
      }

      if (formData.password) {
        updateBody.password = formData.password
      }

      const userRes = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      })

      const userData = await userRes.json()

      if (!userRes.ok) {
        throw new Error(userData.error || 'Failed to update user account')
      }

      setShowSuccess(true)
      setTimeout(() => {
        router.push('/admin/users')
      }, 2000)

    } catch (error: unknown) {
      console.error('Error in handleSubmit:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Gagal memperbarui pengguna' })
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <HiArrowPath className="w-12 h-12 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Memuat data pengguna...</p>
        </div>
      </div>
    )
  }

  if (showSuccess) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiOutlineCheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Berhasil!</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Data pengguna telah diperbarui</p>
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    )
  }

  // --- VIEW MODE ---
  if (isViewMode) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto pb-10">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/users"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Kembali"
            >
              <HiOutlineArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile Pengguna</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Detail informasi pengguna</p>
            </div>
          </div>
          {(session?.user?.role === 'SUPER_ADMIN' || session?.user?.permissions?.includes('user:update')) && (
            <Link
              href={`/admin/users/${id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
            >
              <HiOutlineKey className="w-4 h-4" />
              Edit Data
            </Link>
          )}
        </div>

        {/* Profile Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-bl-full -mr-16 -mt-16 pointer-events-none" />

          <div className="relative flex flex-col md:flex-row gap-8 items-start">
            {/* Avatar */}
            <div className="shrink-0">
              <div className="w-32 h-32 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
                <span className="text-4xl font-bold text-white">
                  {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                </span>
              </div>
            </div>

            {/* Main Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {formData.name || 'Nama Belum Diisi'}
                </h1>
                <div className="flex flex-wrap gap-3 mt-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${formData.isActive
                    ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                    <HiOutlineShieldCheck className="w-4 h-4 mr-1.5" />
                    {formData.isActive ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex items-center text-gray-600 dark:text-gray-300">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center mr-3">
                    <HiOutlineEnvelope className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="font-medium">{user?.email}</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-300">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center mr-3">
                    <HiOutlinePhone className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="font-medium">{formData.phone || '-'}</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-300 sm:col-span-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center mr-3">
                    <HiOutlineIdentification className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="font-medium">
                    {user?.role?.name || 'User (Default)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Department Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <HiOutlineBuildingOffice className="w-5 h-5 text-indigo-500" />
              Departemen
            </h3>
            <p className="text-xl font-medium text-gray-900 dark:text-white">
              {departments.find(d => d.id === formData.departmentId)?.name || user?.departments?.name || user?.department?.name || '-'}
            </p>
          </div>

          {/* Site Card - Multi-site */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <HiOutlineMap className="w-5 h-5 text-green-500" />
              Site / Area Kerja
            </h3>
            {user?.userSites && user.userSites.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.userSites.map((us) => (
                  <span
                    key={us.id}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                      us.isPrimary
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {us.isPrimary && <HiOutlineStar className="w-3.5 h-3.5" />}
                    {us.site.code} - {us.site.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xl font-medium text-gray-900 dark:text-white">
                {user?.sites ? `${user.sites.code} - ${user.sites.name}` 
                  : user?.site ? `${user.site.code} - ${user.site.name}` 
                  : '-'}
              </p>
            )}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap gap-4">
          <div className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${formData.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
            <HiOutlineShieldCheck className="w-4 h-4" />
            {formData.isActive ? 'Akun Aktif' : 'Akun Nonaktif'}
          </div>
          {formData.isSales && (
            <div className="px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              <HiOutlineIdentification className="w-4 h-4" />
              Fitur Sales Aktif
            </div>
          )}
        </div>

        {/* User Performance Stats (New Metric Section) */}
        <UserPerformanceStats userId={id as string} />

        {/* Sales Performance Stats - Only for Sales users */}
        {formData.isSales && (
          <SalesPerformanceStats userId={id as string} />
        )}

      </div>
    )
  }

  // --- EDIT MODE FORM ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/users"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          <HiOutlineArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Pengguna</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Edit akun pengguna: {user?.email}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account Information Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <HiOutlineUserCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informasi Akun</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Data login dan identitas pengguna</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email (Read Only) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Alamat Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineEnvelope className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Email tidak dapat diubah</p>
              </div>

              {/* Role Selection */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Peran Pengguna <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineIdentification className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    name="roleId"
                    required
                    value={formData.roleId}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${errors.roleId ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                      }`}
                  >
                    <option value="">Pilih Peran</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name} {role.description ? `- ${role.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.roleId && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.roleId}</p>}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineUser className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${errors.name ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                      }`}
                  />
                </div>
                {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nomor Telepon
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlinePhone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="+62 812-3456-7890"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kata Sandi Baru
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <HiOutlineKey className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`block w-full pl-10 pr-10 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${errors.password ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      placeholder="Kosongkan jika tidak ingin mengubah"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <HiOutlineEyeSlash className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="flex items-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <HiOutlineKey className="w-5 h-5" />
                    Generate
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Organization Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <HiOutlineBuildingOffice className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Organisasi</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Penempatan departemen dan lokasi kerja</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Departemen
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineBuildingOffice className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    name="departmentId"
                    value={formData.departmentId}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Pilih Departemen</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Site - Multi-site Select */}
              <div>
                <MultiSiteSelect
                  sites={sites}
                  selectedSites={selectedSites}
                  onChange={setSelectedSites}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status & Sales Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-linear-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <HiOutlineShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Akses & Privilese</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pengaturan status dan fitur khusus pengguna</p>
              </div>
            </div>
          </div>
 
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Akun Aktif</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pengguna dapat login ke sistem jika akun aktif</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
 
            <div className="flex items-center justify-between p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
              <div>
                <h3 className="font-medium text-indigo-900 dark:text-indigo-300">Fitur Sales</h3>
                <p className="text-sm text-indigo-600/70 dark:text-indigo-400/60">Aktifkan untuk menampilkan user ini di Manajemen Sales dan mengaktifkan fitur canvasing</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="isSales"
                  checked={formData.isSales}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Working Hours Section */}
        <WorkingHoursSettings
          initialData={{
            workingHourMode: formData.workingHourMode,
            startWorkTime: formData.startWorkTime,
            endWorkTime: formData.endWorkTime,
            workDays: formData.workDays,
            flexibleTargetHour: formData.flexibleTargetHour,
            shiftId: formData.shiftId
          }}
          onChange={(data) => setFormData(prev => ({ ...prev, ...data }))}
        />

        {/* Error Message */}
        {errors.submit && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <HiOutlineExclamationTriangle className="w-6 h-6 text-red-500 dark:text-red-400 shrink-0" />
              <p className="text-red-700 dark:text-red-300">{errors.submit}</p>
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/admin/users"
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                Menyimpan...
              </>
            ) : (
              <>
                <HiOutlineCheckCircle className="w-5 h-5" />
                Simpan Perubahan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
