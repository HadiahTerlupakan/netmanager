"use client";
import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";

import {
  HiOutlineArrowLeft,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineKey,
  HiOutlineUserCircle,
  HiOutlinePhone,
  HiOutlineUser,
  HiOutlineEnvelope,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiArrowPath,
  HiOutlineIdentification,
  HiOutlineGlobeAlt,
} from "react-icons/hi2";
import { UsersDetailView } from "./UsersDetailView";
import { usePermission } from "@/hooks/use-permission";
import { StatusAndSalesSection } from "../components/UserFormSections";
import { generateStrongPassword } from "../lib/password-generator";
import { fetchAdminUserDetail, updateAdminUser } from "../lib/userDetailApi";
import { useUserReferenceData } from "../lib/useUserDetailData";
import type { UserDetailDTO } from "@/modules/users";

const numericFieldNames = new Set(["canvasingTarget"]);

const normalizeNumericField = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  return typeof value === "number" ? value : Number(value);
};

export function ClientComponent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?:
    | Promise<{ [key: string]: string | string[] | undefined }>
    | undefined;
}) {
  const { id } = use(params);
  const router = useRouter();

  const searchParamsValue = use(
    searchParams ||
      Promise.resolve({} as { [key: string]: string | string[] | undefined }),
  );
  const isViewMode = searchParamsValue["view"] === "true";

  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("users:update");
  const canReadTenants = hasPermission("tenants:read");
  const canViewLeaveQuotas =
    hasPermission("users:read") || hasPermission("attendance:read");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { departments, roles, tenants } = useUserReferenceData({
    canReadTenants,
  });
  const [user, setUser] = useState<UserDetailDTO | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    password: "",
    departmentId: "",
    siteId: "",
    roleId: "",
    isActive: true,
    workingHourMode: "FIXED",
    startWorkTime: "",
    endWorkTime: "",
    workDays: "",
    flexibleTargetHour: 8,
    isSales: false,
    canvasingTarget: 0,
    targetSchema: "REVENUE",
    tenantId: "",
  });

  const currentFormSnapshot = JSON.stringify({ formData });
  const hasFormChanges =
    initialFormSnapshot !== "" && currentFormSnapshot !== initialFormSnapshot;

  const fetchUser = useCallback(async () => {
    try {
      const usr = await fetchAdminUserDetail(id);

      if (usr) {
        setUser(usr);
        const loadedFormData = {
          name: usr.name ?? "",
          phone: usr.phone ?? "",
          password: "",
          departmentId: usr.departmentId ?? usr.department?.id ?? "",
          siteId: usr.siteId ?? usr.site?.id ?? "",
          roleId: usr.roleId ?? usr.role?.id ?? "",
          isActive: usr.isActive,
          workingHourMode: usr.workingHourMode ?? "FIXED",
          startWorkTime: usr.startWorkTime ?? "",
          endWorkTime: usr.endWorkTime ?? "",
          workDays: usr.workDays ?? "",
          flexibleTargetHour: usr.flexibleTargetHour ?? 8,
          isSales: usr.isSales ?? false,
          canvasingTarget: usr.canvasingTarget ?? 0,
          targetSchema: usr.targetSchema ?? "REVENUE",
          tenantId: usr.tenantId ?? usr.tenant?.id ?? "",
        };
        setFormData(loadedFormData);
        setInitialFormSnapshot(JSON.stringify({ formData: loadedFormData }));
      }
    } catch (error: unknown) {
      clientLogger.error("Error fetching user:", error);
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      toast.error("Gagal memuat data user: " + message);
      setErrors({ fetch: message });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void fetchUser();
    }, 0);
    return () => clearTimeout(handle);
  }, [fetchUser]);

  const generatePassword = () => {
    setFormData((prev) => ({ ...prev, password: generateStrongPassword() }));
    setShowPassword(true);
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.password;
      return newErrors;
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : numericFieldNames.has(name)
            ? value === ""
              ? ""
              : Number(value)
            : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) {
      newErrors.name = "Nama wajib diisi";
    }

    if (canReadTenants && !formData.tenantId) {
      newErrors.tenantId = "Tenant wajib dipilih";
    }

    if (!formData.roleId) {
      newErrors.roleId = "Peran pengguna wajib dipilih";
    }

    if (formData.password && formData.password.length < 8) {
      newErrors.password = "Password minimal 8 karakter jika diisi";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit: React.ComponentProps<"form">["onSubmit"] = async (
    event,
  ) => {
    event?.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!hasFormChanges) {
      setErrors({ submit: "Belum ada perubahan untuk disimpan" });
      return;
    }

    setSubmitting(true);

    try {
      const updateBody: Record<string, unknown> = {
        name: formData.name,
        phone: formData.phone || null,
        roleId: formData.roleId,
        isActive: formData.isActive,
        isSales: formData.isSales,
        canvasingTarget: normalizeNumericField(formData.canvasingTarget),
        targetSchema: formData.targetSchema,
        tenantId: formData.tenantId || null,
      };

      if (formData.password) {
        updateBody.password = formData.password;
      }

      await updateAdminUser(id, updateBody);

      setShowSuccess(true);
      setTimeout(() => {
        router.push("/admin/users");
      }, 2000);
    } catch (error: unknown) {
      clientLogger.error("Error in handleSubmit:", error);
      setErrors({
        submit:
          error instanceof Error ? error.message : "Gagal memperbarui pengguna",
      });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <HiArrowPath className="w-12 h-12 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Memuat data pengguna...
          </p>
        </div>
      </div>
    );
  }

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
            Data pengguna telah diperbarui
          </p>
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  // --- VIEW MODE ---
  if (isViewMode) {
    return (
      <UsersDetailView
        userId={id as string}
        user={user as UserDetailDTO | null}
        formData={{
          name: formData.name,
          phone: formData.phone,
          isActive: formData.isActive,
          isSales: formData.isSales,
          departmentId: formData.departmentId,
          workingHourMode: formData.workingHourMode,
          startWorkTime: formData.startWorkTime,
          endWorkTime: formData.endWorkTime,
          workDays: formData.workDays,
          flexibleTargetHour: formData.flexibleTargetHour,
        }}
        departments={departments}
        canUpdate={canUpdate}
        canViewLeaveQuotas={canViewLeaveQuotas}
        hasPermission={hasPermission}
      />
    );
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Pengguna
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Edit akun pengguna: {user?.email}
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
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tenant Selection (Super Admin only) - MOVED TO TOP */}
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

              {/* Email (Read Only) */}
              <div className="md:col-span-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Alamat Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineEnvelope className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    disabled
                    value={user?.email || ""}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Email tidak dapat diubah
                </p>
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
                    placeholder="08123456789 atau 628123456789"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="md:col-span-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Kata Sandi Baru
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
                      placeholder="Kosongkan jika tidak ingin mengubah"
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
          </div>{" "}
        </div>

        {canUpdate && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Data kepegawaian
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Departemen, site, jam kerja, dan kuota cuti dikelola di menu HR.
              </p>
            </div>
            <Link
              href={`/admin/hr/employees/${id}`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Buka di HR
            </Link>
          </div>
        )}

        <StatusAndSalesSection
          formData={formData}
          handleChange={handleChange}
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
          {canUpdate && (
            <button
              type="submit"
              disabled={submitting || !hasFormChanges}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          )}
        </div>
      </form>
    </div>
  );
}
