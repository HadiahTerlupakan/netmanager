"use client"
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  HiOutlineArrowLeft,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineKey,
  HiOutlineUserCircle,
  HiOutlineBriefcase,
  HiOutlineBuildingOffice,
  HiOutlinePhone,
  HiOutlineCalendar,
  HiOutlineUser,
  HiOutlineMap,
  HiOutlineCreditCard,
  HiOutlineDocumentText,
  HiOutlineExclamationTriangle,
  HiOutlineInformationCircle,
  HiOutlineCheckCircle,
  HiCheckBadge,
  HiArrowPath
} from 'react-icons/hi2'

interface Department {
  id: string
  name: string
}

export default function UserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [user, setUser] = useState<any>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSuccess, setShowSuccess] = useState(false)

  // Combined form data
  const [formData, setFormData] = useState({
    // User fields
    name: '',
    password: '',
    role: 'USER',
    // Employee fields
    employeeId: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    idCardNumber: '',
    address: '',
    city: '',
    province: '',
    departmentId: '',
    positionId: '',
    employmentStatus: 'PROBATION',
    joinDate: '',
    probationEndDate: '',
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
    npwp: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
  })

  useEffect(() => {
    Promise.all([
      fetchUserAndEmployee(),
      fetchDepartments()
    ]).finally(() => setLoading(false))
  }, [id])

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/hris/departments')
      const data = await res.json()
      if (res.ok) {
        setDepartments(data.departments || [])
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchUserAndEmployee = async () => {
    try {
      const res = await fetch(`/api/users/${id}`)
      const data = await res.json()
      const usr = data.user

      if (usr) {
        setUser(usr)
        const emp = usr.employee || {}

        setFormData(prev => ({
          ...prev,
          // User data
          name: usr.name || '',
          role: usr.role,

          // Employee data
          employeeId: emp.employeeId || '',
          phone: emp.phone || '',
          dateOfBirth: emp.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().split('T')[0] : '',
          gender: emp.gender || '',
          idCardNumber: emp.idCardNumber || '',
          address: emp.address || '',
          city: emp.city || '',
          province: emp.province || '',
          departmentId: emp.departmentId || '',
          positionId: emp.positionId || '',
          employmentStatus: emp.employmentStatus || 'PROBATION',
          joinDate: emp.joinDate ? new Date(emp.joinDate).toISOString().split('T')[0] : '',
          probationEndDate: emp.probationEndDate ? new Date(emp.probationEndDate).toISOString().split('T')[0] : '',
          bankName: emp.bankName || '',
          bankAccountNumber: emp.bankAccountNumber || '',
          bankAccountName: emp.bankAccountName || '',
          npwp: emp.npwp || '',
          emergencyName: emp.emergencyName || '',
          emergencyPhone: emp.emergencyPhone || '',
          emergencyRelation: emp.emergencyRelation || '',
        }))
      }
    } catch (error) {
      console.error('Error fetching user:', error)
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Clear error when user types in a field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Validation function
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name) {
      newErrors.name = 'Nama wajib diisi'
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password minimal 6 karakter jika diisi'
    }

    if (!formData.employeeId) {
      newErrors.employeeId = 'Employee ID wajib diisi'
    }

    if (!formData.joinDate) {
      newErrors.joinDate = 'Tanggal bergabung wajib diisi'
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
      // 1. Update User
      const userUpdateBody: any = {
        name: formData.name,
        role: formData.role,
      }
      if (formData.password) {
        userUpdateBody.password = formData.password
      }

      const userRes = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userUpdateBody),
      })

      const userData = await userRes.json()

      if (!userRes.ok) {
        throw new Error(userData.error || 'Failed to update user account')
      }

      // 2. Update Employee (if exists)
      if (user?.employee?.id) {
        const employeeRes = await fetch(`/api/hris/employees/${user.employee.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: formData.employeeId,
            fullName: formData.name, // Sync name
            phone: formData.phone || undefined,
            dateOfBirth: formData.dateOfBirth || undefined,
            gender: formData.gender || undefined,
            idCardNumber: formData.idCardNumber || undefined,
            address: formData.address || undefined,
            city: formData.city || undefined,
            province: formData.province || undefined,
            departmentId: formData.departmentId || undefined,
            positionId: formData.positionId || undefined,
            employmentStatus: formData.employmentStatus,
            joinDate: formData.joinDate,
            probationEndDate: formData.probationEndDate || undefined,
            bankName: formData.bankName || undefined,
            bankAccountNumber: formData.bankAccountNumber || undefined,
            bankAccountName: formData.bankAccountName || undefined,
            npwp: formData.npwp || undefined,
            emergencyName: formData.emergencyName || undefined,
            emergencyPhone: formData.emergencyPhone || undefined,
            emergencyRelation: formData.emergencyRelation || undefined,
          }),
        })

        const employeeData = await employeeRes.json()

        if (!employeeRes.ok) {
          throw new Error(employeeData.error || 'Failed to update employee profile')
        }
      }

      // Show success message and redirect
      setShowSuccess(true)
      setTimeout(() => {
        router.push('/admin/users')
      }, 2000)

    } catch (error: any) {
      console.error('Error in handleSubmit:', error)
      setErrors({ submit: error.message || 'Gagal memperbarui pengguna' })
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
            Edit akun pengguna dan data karyawan: {user?.email}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Account Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <HiOutlineUserCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Akun Pengguna</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Informasi login dan peran pengguna</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Alamat Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineUser className="h-5 w-5 text-gray-400" />
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Peran Pengguna <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  required
                  value={formData.role}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${errors.role ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                    }`}
                >
                  <option value="USER">USER (Pegawai Biasa)</option>
                  <option value="HR">HR (Admin HR)</option>
                  <option value="ADMIN">ADMIN (Akses Penuh)</option>
                  <option value="FINANCE">FINANCE (Admin Keuangan)</option>
                </select>
              </div>

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

        {/* Employee Information Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <HiOutlineBriefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informasi Karyawan</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Detail pribadi dan kontak karyawan</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ID Karyawan <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiCheckBadge className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="employeeId"
                    required
                    value={formData.employeeId}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${errors.employeeId ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                      }`}
                  />
                </div>
                {errors.employeeId && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.employeeId}</p>}
              </div>

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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Lahir
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineCalendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Jenis Kelamin
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Pilih Jenis Kelamin</option>
                  <option value="MALE">Pria</option>
                  <option value="FEMALE">Wanita</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nomor KTP
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineDocumentText className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="idCardNumber"
                    value={formData.idCardNumber}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Nomor KTP"
                  />
                </div>
              </div>

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
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alamat Lengkap
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 pt-3 flex items-start pointer-events-none">
                  <HiOutlineMap className="h-5 w-5 text-gray-400 mt-1" />
                </div>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Alamat lengkap karyawan"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kota
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Kota tempat tinggal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Provinsi
                </label>
                <input
                  type="text"
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Provinsi tempat tinggal"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Employment Information Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <HiOutlineInformationCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informasi Kepegawaian</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Status dan tanggal kepegawaian</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status Kepegawaian <span className="text-red-500">*</span>
                </label>
                <select
                  name="employmentStatus"
                  required
                  value={formData.employmentStatus}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="PROBATION">Masa Percobaan</option>
                  <option value="PERMANENT">Tetap</option>
                  <option value="CONTRACT">Kontrak</option>
                  <option value="INTERNSHIP">Magang</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Bergabung <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="joinDate"
                  required
                  value={formData.joinDate}
                  onChange={handleChange}
                  className={`block w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${errors.joinDate ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                    }`}
                />
                {errors.joinDate && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.joinDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Akhir Masa Percobaan
                </label>
                <input
                  type="date"
                  name="probationEndDate"
                  value={formData.probationEndDate}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bank Information Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <HiOutlineCreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informasi Perbankan</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Detail rekening untuk gaji</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nama Bank
                </label>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Nama bank"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nomor Rekening
                </label>
                <input
                  type="text"
                  name="bankAccountNumber"
                  value={formData.bankAccountNumber}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Nomor rekening"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Atas Nama
                </label>
                <input
                  type="text"
                  name="bankAccountName"
                  value={formData.bankAccountName}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Atas nama rekening"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                NPWP
              </label>
              <input
                type="text"
                name="npwp"
                value={formData.npwp}
                onChange={handleChange}
                className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Nomor Pokok Wajib Pajak"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <HiOutlineExclamationTriangle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kontak Darurat</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Kontak dalam keadaan darurat</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nama
                </label>
                <input
                  type="text"
                  name="emergencyName"
                  value={formData.emergencyName}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Nama kontak darurat"
                />
              </div>

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
                    name="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="+62 812-3456-7890"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hubungan
                </label>
                <input
                  type="text"
                  name="emergencyRelation"
                  value={formData.emergencyRelation}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Contoh: Pasangan, Orang Tua"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <HiOutlineExclamationTriangle className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-300">{errors.submit}</p>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/admin/users"
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <HiArrowPath className="w-5 h-5 animate-spin" />}
            {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  )
}


