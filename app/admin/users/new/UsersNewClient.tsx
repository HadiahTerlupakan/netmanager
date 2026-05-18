"use client";
import { clientLogger } from "@/lib/client-logger";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "@/lib/hooks/useApi";
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
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
  HiOutlineShieldCheck,
  HiOutlineIdentification,
  HiOutlineGlobeAlt,
  HiOutlineStar,
  HiOutlineCurrencyDollar,
  HiOutlineClock,
} from "react-icons/hi2";
import MultiSiteSelect from "../components/MultiSiteSelect";
import WorkingHoursSettings from "../[id]/WorkingHoursSettings";
import LeaveBalanceSettings from "../[id]/LeaveBalanceSettings";
import { usePermission } from "@/hooks/use-permission";
import {
  OVERTIME_CALC_TYPE_OPTIONS,
  OVERTIME_COLOR_CLASSES,
  OVERTIME_CONFIGS,
} from "../lib/overtime-config";
import { generateStrongPassword } from "../lib/password-generator";
import { useUserReferenceData } from "../lib/useUserDetailData";

interface SelectedSite {
  siteId: string;
  isPrimary: boolean;
}

export function ClientComponent() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const searchParams = useSearchParams();
  const tenantIdParam = searchParams.get("tenantId");
  const canCreate = hasPermission("users:create");
  const canReadTenants = hasPermission("tenants:read");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { departments, roles, sites, tenants } = useUserReferenceData({
    canReadTenants,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [leaveQuotas, setLeaveQuotas] = useState<Record<string, number>>({});

  const [formData, setFormData] = useState({
    // Account Information
    email: "",
    emailChecked: false,
    emailExists: false,
    emailRole: "",
    isCheckingEmail: false,
    name: "",
    password: "",
    phone: "",
    // Organization
    departmentId: "",
    // Role
    roleId: "",
    // Status & Features
    isActive: true,
    isSales: false,
    tenantId: "",
    // Sales Target
    canvasingTarget: 0,
    targetSchema: "REVENUE",
    // Salary configuration
    basicSalary: 0,
    payPeriodDay: 1,
    payDay: 25,
    woIncentiveEnabled: false,
    woIncentiveRate: 0,
    lateDeductionRate: 0,
    absentDeductionRate: 0,
    overtimeRateNormal: 0,
    overtimeRateHoliday: 0,
    overtimeRateNational: 0,
    overtimeCalcTypeNormal: "FIXED",
    overtimeCalcTypeHoliday: "FIXED",
    overtimeCalcTypeNational: "FIXED",
  });
  const [selectedSites, setSelectedSites] = useState<SelectedSite[]>([]);

  // Working Hours Data
  const [workingHoursData, setWorkingHoursData] = useState({
    workingHourMode: "FIXED",
    attendanceGeofencePolicy: "WARN",
    isAttendanceRequired: true,
    startWorkTime: "09:00",
    endWorkTime: "17:00",
    workDays: "Mon,Tue,Wed,Thu,Fri",
    flexibleTargetHour: 8,
    shiftId: null as string | null,
  });

  const [prevTenantParamKey, setPrevTenantParamKey] = useState<string>(
    `${canReadTenants}|${tenantIdParam ?? ""}`,
  );
  const tenantParamKey = `${canReadTenants}|${tenantIdParam ?? ""}`;
  if (prevTenantParamKey !== tenantParamKey) {
    setPrevTenantParamKey(tenantParamKey);
    if (canReadTenants && tenantIdParam) {
      setFormData((prev) => ({ ...prev, tenantId: tenantIdParam }));
    }
  }

  const generatePassword = () => {
    setFormData((prev) => ({ ...prev, password: generateStrongPassword() }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.password;
      return newErrors;
    });
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (name === "email") {
      setFormData((prev) => ({
        ...prev,
        emailChecked: false,
        emailExists: false,
      }));
    }

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Real-time email validation with debounce.
  // Sync invalid-email reset is handled via render-time comparator (avoid
  // setState-in-effect lint).
  const isEmailValid =
    !!formData.email && /^\S+@\S+\.\S+$/.test(formData.email);
  const [prevEmailValid, setPrevEmailValid] = useState<boolean>(isEmailValid);
  if (prevEmailValid !== isEmailValid) {
    setPrevEmailValid(isEmailValid);
    if (!isEmailValid) {
      setFormData((prev) => ({
        ...prev,
        emailChecked: false,
        isCheckingEmail: false,
      }));
    }
  }

  // Debounce email value untuk dipakai sebagai query key useApi.
  // TanStack Query auto-cancel request saat key berubah, jadi tidak
  // perlu AbortController manual.
  const [debouncedEmail, setDebouncedEmail] = useState(formData.email);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedEmail(formData.email), 800);
    return () => clearTimeout(timer);
  }, [formData.email]);

  const checkIdentifierUrl =
    isEmailValid && debouncedEmail === formData.email
      ? `/api/admin/users/check-identifier?email=${encodeURIComponent(debouncedEmail)}`
      : null;

  const {
    data: checkData,
    error: checkError,
    isLoading: checkingEmail,
  } = useApi<{ exists: boolean; role: string }>(checkIdentifierUrl);

  // Hydrate hasil check ke formData + errors. Pakai key dari URL untuk
  // memastikan hydrate hanya jalan sekali per request.
  const [lastHydratedKey, setLastHydratedKey] = useState<string | null>(null);
  if (checkData && checkIdentifierUrl !== lastHydratedKey) {
    setLastHydratedKey(checkIdentifierUrl);
    setFormData((prev) => ({
      ...prev,
      emailChecked: true,
      emailExists: checkData.exists,
      emailRole: checkData.role || "",
      isCheckingEmail: false,
    }));
    if (checkData.exists) {
      setErrors((prev) => ({
        ...prev,
        email: `Email sudah terdaftar sebagai ${checkData.role}`,
      }));
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      });
    }
  }

  // Sync isCheckingEmail flag ke formData
  const [prevCheckingEmail, setPrevCheckingEmail] = useState(checkingEmail);
  if (prevCheckingEmail !== checkingEmail) {
    setPrevCheckingEmail(checkingEmail);
    setFormData((prev) => ({ ...prev, isCheckingEmail: checkingEmail }));
  }

  useEffect(() => {
    if (checkError) {
      clientLogger.error("Error checking email:", checkError);
    }
  }, [checkError]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = "Email wajib diisi";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Format email tidak valid";
    } else if (formData.isCheckingEmail) {
      newErrors.email = "Validasi email sedang diproses";
    } else if (!formData.emailChecked) {
      newErrors.email = "Mohon tunggu validasi email selesai";
    } else if (formData.emailExists) {
      newErrors.email = `Email sudah terdaftar sebagai ${formData.emailRole}`;
    }

    if (!formData.name) {
      newErrors.name = "Nama wajib diisi";
    }

    if (!formData.password) {
      newErrors.password = "Password wajib diisi";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password minimal 8 karakter";
    }

    if (canReadTenants && !formData.tenantId) {
      newErrors.tenantId = "Tenant wajib dipilih";
    }

    if (!formData.roleId) {
      newErrors.roleId = "Peran pengguna wajib dipilih";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Clean up data before sending
      const tenantScopedFormData = canReadTenants
        ? formData
        : { ...formData, tenantId: undefined };

      const submitData = {
        ...tenantScopedFormData,
        ...workingHoursData,
        // Convert empty strings to undefined/null for optional fields
        departmentId: formData.departmentId || null,
        phone: formData.phone || null,
        // Ensure shiftId is handled correctly (already handled in WorkingHoursSettings but good to be safe)
        shiftId: workingHoursData.shiftId || null,
        userSites: selectedSites,
        leaveQuotas: leaveQuotas,
      };

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (res.ok) {
        setShowSuccess(true);
        setTimeout(() => {
          router.push("/admin/users");
        }, 2000);
      } else {
        // Handle validation errors from server
        if (data.code === "VALIDATION_ERROR" && data.details) {
          const serverErrors: Record<string, string> = {};
          // Map server validation details to form errors
          Object.entries(data.details).forEach(([key, msg]) => {
            serverErrors[key] = msg as string;
          });
          setErrors({
            ...serverErrors,
            submit:
              "Terdapat kesalahan validasi. Periksa kembali inputan Anda.",
          });
        } else {
          setErrors({ submit: data.error || "Gagal membuat pengguna" });
        }
      }
    } catch (error) {
      clientLogger.error("Error:", error);
      setErrors({ submit: "Terjadi kesalahan. Silakan coba lagi." });
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiOutlineCheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            Berhasil!
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Pengguna baru telah dibuat
          </p>
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tambah Pengguna Baru
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Buat akun pengguna baru untuk sistem
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Account Information Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <HiOutlineUserCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Informasi Akun
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Data login dan identitas pengguna
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tenant Selection (Super Admin only) */}
              {canReadTenants && (
                <div className="md:col-span-2">
                  <label
                    htmlFor="tenantId"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Tenant <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <HiOutlineGlobeAlt className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      id="tenantId"
                      name="tenantId"
                      value={formData.tenantId}
                      onChange={handleChange}
                      className={`block w-full pl-10 pr-3 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                        errors.tenantId
                          ? "border-red-300 dark:border-red-700"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      <option value="">Pilih Tenant</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Pilih tenant untuk pengguna ini. Pengguna akan dibatasi
                    hanya pada data milik tenant ini.
                  </p>
                  {errors.tenantId && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.tenantId}
                    </p>
                  )}
                </div>
              )}

              {/* Email */}
              <div className="md:col-span-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Alamat Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineEnvelope className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-10 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      errors.email
                        ? "border-red-300 dark:border-red-700"
                        : formData.emailChecked && !formData.emailExists
                          ? "border-green-500 dark:border-green-600"
                          : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="contoh@perusahaan.com"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {formData.isCheckingEmail ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500"></div>
                    ) : (
                      formData.emailChecked &&
                      (formData.emailExists ? (
                        <HiOutlineExclamationTriangle className="h-5 w-5 text-red-500" />
                      ) : (
                        <HiOutlineCheckCircle className="h-5 w-5 text-green-500" />
                      ))
                    )}
                  </div>
                </div>
                {errors.email && (
                  <p
                    className={`mt-1 text-sm ${formData.emailExists ? "text-red-600 dark:text-red-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {errors.email}
                  </p>
                )}
                {formData.emailChecked && !formData.emailExists && (
                  <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                    Email tersedia
                  </p>
                )}
              </div>

              {/* Role Selection */}
              <div className="md:col-span-2">
                <label
                  htmlFor="roleId"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Peran Pengguna <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineIdentification className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    id="roleId"
                    name="roleId"
                    value={formData.roleId}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      errors.roleId
                        ? "border-red-300 dark:border-red-700"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    <option value="">Pilih Peran</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}{" "}
                        {role.description ? `- ${role.description}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.roleId && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.roleId}
                  </p>
                )}
              </div>

              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineUser className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      errors.name
                        ? "border-red-300 dark:border-red-700"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="Nama lengkap pengguna"
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Nomor Telepon
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlinePhone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="phone"
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
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Kata Sandi <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <HiOutlineKey className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`block w-full pl-10 pr-10 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                        errors.password
                          ? "border-red-300 dark:border-red-700"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="Minimal 8 karakter"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword
                          ? "Sembunyikan kata sandi"
                          : "Tampilkan kata sandi"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <HiOutlineEyeSlash className="w-5 h-5" />
                      ) : (
                        <HiOutlineEye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generatePassword}
                    aria-label="Buat kata sandi otomatis"
                    className="flex items-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <HiOutlineKey className="w-5 h-5" />
                    Generate
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.password}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Organization Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <HiOutlineBuildingOffice className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Organisasi
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Penempatan departemen dan lokasi kerja
                </p>
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
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Site diperlukan untuk melihat work order di area tersebut
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Working Hours Settings */}
        <WorkingHoursSettings
          initialData={{
            workingHourMode: workingHoursData.workingHourMode,
            attendanceGeofencePolicy: workingHoursData.attendanceGeofencePolicy,
            isAttendanceRequired: workingHoursData.isAttendanceRequired,
            startWorkTime: workingHoursData.startWorkTime,
            endWorkTime: workingHoursData.endWorkTime,
            workDays: workingHoursData.workDays,
            flexibleTargetHour: workingHoursData.flexibleTargetHour,
            shiftId: workingHoursData.shiftId,
          }}
          onChange={(data) =>
            setWorkingHoursData((prev) => ({ ...prev, ...data }))
          }
        />

        {/* Status & Sales Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <HiOutlineShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Akses & Privilege
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pengaturan status dan fitur khusus pengguna
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Akun Aktif
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Pengguna dapat login ke sistem jika akun aktif
                </p>
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
                <h3 className="font-medium text-indigo-900 dark:text-indigo-300">
                  Fitur Sales & Canvassing
                </h3>
                <p className="text-sm text-indigo-600/70 dark:text-indigo-400/60">
                  Aktifkan jika user adalah Sales atau Teknisi yang merangkap
                  Sales. User akan tampil di Manajemen Sales dan bisa akses menu
                  Canvassing.
                </p>
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

            {/* Sales Target - Only if isSales is true */}
            {formData.isSales && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Canvassing (Poin)
                  </label>
                  <input
                    type="number"
                    name="canvasingTarget"
                    value={formData.canvasingTarget}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Skema Target
                  </label>
                  <select
                    name="targetSchema"
                    value={formData.targetSchema}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="REVENUE">Revenue (Pendapatan)</option>
                    <option value="QUANTITY">Quantity (Jumlah Unit)</option>
                    <option value="POINTS">Points (Poin Kinerja)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Basic Salary - Only if admin has permission */}
            {hasPermission("payroll:read") && (
              <div className="p-4 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                <h3 className="font-medium text-emerald-900 dark:text-emerald-300 mb-3 flex items-center gap-2">
                  <HiOutlineStar className="w-4 h-4" />
                  Konfigurasi Gaji Pokok
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                      Gaji Pokok (Rp)
                    </label>
                    <input
                      type="number"
                      name="basicSalary"
                      value={formData.basicSalary}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 border border-emerald-200 dark:border-emerald-800 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                      Tgl Mulai Periode
                    </label>
                    <input
                      type="number"
                      name="payPeriodDay"
                      min="1"
                      max="31"
                      value={formData.payPeriodDay}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 border border-emerald-200 dark:border-emerald-800 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                      Tgl Gajian
                    </label>
                    <input
                      type="number"
                      name="payDay"
                      min="1"
                      max="31"
                      value={formData.payDay}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 border border-emerald-200 dark:border-emerald-800 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Incentives & Deductions */}
                <div className="mt-4 pt-4 border-t border-emerald-100 dark:border-emerald-900/20">
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-500 uppercase tracking-wider mb-3">
                    Insentif & Potongan
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                      <div>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Insentif WO
                        </span>
                        <p className="text-[10px] text-gray-500">
                          Aktifkan bonus per WO selesai
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {formData.woIncentiveEnabled && (
                          <input
                            type="number"
                            name="woIncentiveRate"
                            value={formData.woIncentiveRate}
                            onChange={handleChange}
                            placeholder="Rp/WO"
                            className="w-24 px-2 py-1 text-xs border border-emerald-200 dark:border-emerald-800 rounded bg-emerald-50/50 dark:bg-emerald-900/20 text-gray-900 dark:text-white"
                          />
                        )}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="woIncentiveEnabled"
                            checked={formData.woIncentiveEnabled}
                            onChange={handleChange}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-rose-100 dark:border-rose-900/20">
                        <span className="text-xs font-medium text-rose-700 dark:text-rose-400 block mb-1">
                          Denda Terlambat
                        </span>
                        <input
                          type="number"
                          name="lateDeductionRate"
                          value={formData.lateDeductionRate}
                          onChange={handleChange}
                          placeholder="Rp/Menit"
                          className="w-full px-2 py-1 text-xs border border-rose-100 dark:border-rose-900/30 rounded bg-rose-50/30 dark:bg-rose-900/10 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-rose-100 dark:border-rose-900/20">
                        <span className="text-xs font-medium text-rose-700 dark:text-rose-400 block mb-1">
                          Denda Mangkir
                        </span>
                        <input
                          type="number"
                          name="absentDeductionRate"
                          value={formData.absentDeductionRate}
                          onChange={handleChange}
                          placeholder="Rp/Hari"
                          className="w-full px-2 py-1 text-xs border border-rose-100 dark:border-rose-900/30 rounded bg-rose-50/30 dark:bg-rose-900/10 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overtime Configuration */}
                <div className="mt-4 pt-4 border-t border-emerald-100 dark:border-emerald-900/20">
                  <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <HiOutlineClock className="w-3.5 h-3.5" />
                    Konfigurasi Lembur
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {OVERTIME_CONFIGS.map((item) => {
                      const colorCls = OVERTIME_COLOR_CLASSES[item.color];
                      return (
                        <div
                          key={item.key}
                          className={`p-3 bg-white dark:bg-gray-800 rounded-lg border ${colorCls.border}`}
                        >
                          <span
                            className={`text-xs font-bold ${colorCls.text} ${colorCls.textDark} block mb-2`}
                          >
                            {item.label}
                          </span>
                          <div className="space-y-2">
                            <select
                              name={item.calcTypeKey}
                              value={formData[item.calcTypeKey]}
                              onChange={handleChange}
                              className="w-full px-2 py-1 text-[10px] border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900/30 text-gray-900 dark:text-white"
                            >
                              {OVERTIME_CALC_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <div className="relative">
                              <input
                                type="number"
                                name={item.rateKey}
                                value={formData[item.rateKey]}
                                onChange={handleChange}
                                className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                              />
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                                Rp
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Leave Balance Configuration */}
        {hasPermission("attendance:read") && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <HiOutlineCurrencyDollar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Kuota Cuti Awal
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Inisialisasi saldo cuti dan izin tahunan
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <LeaveBalanceSettings
                userId="NEW_USER"
                workingHourMode={workingHoursData.workingHourMode}
                onChange={(quotas) => setLeaveQuotas(quotas)}
                saveButtonLabel="Simpan Pengguna"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                ℹ️ Kuota ini akan diterapkan segera setelah akun pengguna
                dibuat. Mode **FLEXIBLE** biasanya tidak memerlukan kuota cuti.
              </p>
            </div>
          </div>
        )}

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
          {canCreate && (
            <button
              type="submit"
              disabled={loading || formData.isCheckingEmail}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  Menyimpan...
                </>
              ) : (
                <>
                  <HiOutlineCheckCircle className="w-5 h-5" />
                  Simpan Pengguna
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
