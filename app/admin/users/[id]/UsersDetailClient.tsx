"use client";
import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";

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
  HiOutlineStar,
  HiOutlineGlobeAlt,
  HiOutlineClock,
} from "react-icons/hi2";
import WorkingHoursSettings from "./WorkingHoursSettings";
import LeaveBalanceSettings from "./LeaveBalanceSettings";
import LeaveQuotaSummary from "./LeaveQuotaSummary";
import UserPerformanceStats from "./UserPerformanceStats";
import SalesPerformanceStats from "./SalesPerformanceStats";
import MultiSiteSelect from "../components/MultiSiteSelect";
import { usePermission } from "@/hooks/use-permission";
import {
  getSelectedSitesFromUser,
  getSitesFromUser,
  mergeSites,
} from "./user-detail-helpers";

interface SelectedSite {
  siteId: string;
  isPrimary: boolean;
}

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface Site {
  id: string;
  code: string;
  name: string;
}

interface Tenant {
  id: string;
  name: string;
}

interface UserSiteRelation {
  id?: string;
  siteId?: string | null;
  isPrimary?: boolean | null;
  site?: { id?: string | null; code: string; name: string } | null;
}

interface UserData {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  departmentId: string | null;
  siteId: string | null;
  roleId?: string | null;
  isActive: boolean;
  department?: { name: string } | null;
  departments?: { name: string } | null;
  site?: { code: string; name: string } | null;
  sites?: { code: string; name: string } | null;
  role?: { name: string } | null;
  userSites?: UserSiteRelation[];
  // Working hours
  workingHourMode?: string;
  attendanceGeofencePolicy?: string | null;
  startWorkTime?: string | null;
  endWorkTime?: string | null;
  workDays?: string | null;
  flexibleTargetHour?: number | null;
  shiftId?: string | null;
  shift?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
  canvasingTarget?: number;
  isSales?: boolean;
  isAttendanceRequired?: boolean;
  tenantId?: string | null;
  tenant?: { id: string; name: string } | null;
}

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
  const canManageLeaveQuotas =
    hasPermission("users:update") || hasPermission("attendance:update");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [leaveQuotas, setLeaveQuotas] = useState<Record<string, number>>({}); // For leave balance integration
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [user, setUser] = useState<UserData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [selectedSites, setSelectedSites] = useState<SelectedSite[]>([]);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState("");
  const [hasLoadedLeaveQuotas, setHasLoadedLeaveQuotas] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    password: "",
    departmentId: "",
    siteId: "",
    roleId: "",
    isActive: true,
    // Working Hours
    workingHourMode: "FIXED",
    attendanceGeofencePolicy: "WARN",
    isAttendanceRequired: true,
    startWorkTime: "",
    endWorkTime: "",
    workDays: "",
    flexibleTargetHour: 8,
    shiftId: "",
    isSales: false,
    canvasingTarget: 0,
    targetSchema: "REVENUE",
    tenantId: "",
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

  const currentFormSnapshot = JSON.stringify({
    formData,
    selectedSites,
    leaveQuotas,
  });
  const hasFormChanges =
    initialFormSnapshot !== "" && currentFormSnapshot !== initialFormSnapshot;

  const overtimeConfigs = [
    {
      key: "Normal",
      label: "Hari Kerja",
      color: "indigo",
      calcTypeField: "overtimeCalcTypeNormal",
      rateField: "overtimeRateNormal",
    },
    {
      key: "Holiday",
      label: "Hari Libur",
      color: "amber",
      calcTypeField: "overtimeCalcTypeHoliday",
      rateField: "overtimeRateHoliday",
    },
    {
      key: "National",
      label: "Libur Nas.",
      color: "rose",
      calcTypeField: "overtimeCalcTypeNational",
      rateField: "overtimeRateNational",
    },
  ] as const;

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      const data = await res.json();
      // Handle both wrapped (apiSuccess) and unwrapped response formats
      const result = data.data || data;
      const usr = result.user;

      if (usr) {
        setUser(usr);
        const loadedFormData = {
          name: usr.name || "",
          phone: usr.phone || "",
          password: "",
          departmentId: usr.departmentId || "",
          siteId: usr.siteId || "",
          roleId: usr.roleId || "",
          isActive: usr.isActive ?? true,
          // Working Hours
          workingHourMode: usr.workingHourMode || "FIXED",
          attendanceGeofencePolicy: usr.attendanceGeofencePolicy || "WARN",
          isAttendanceRequired: usr.isAttendanceRequired ?? true,
          startWorkTime: usr.startWorkTime || "",
          endWorkTime: usr.endWorkTime || "",
          workDays: usr.workDays || "",
          flexibleTargetHour: usr.flexibleTargetHour || 8,
          shiftId: usr.shiftId || "",
          isSales: usr.isSales || false,
          canvasingTarget: usr.canvasingTarget || 0,
          targetSchema: usr.targetSchema || "REVENUE",
          tenantId: usr.tenantId || usr.tenant?.id || "",
          // Salary configuration
          basicSalary: usr.basicSalary || 0,
          payPeriodDay: usr.payPeriodDay || 1,
          payDay: usr.payDay || 25,
          woIncentiveEnabled: usr.woIncentiveEnabled || false,
          woIncentiveRate: usr.woIncentiveRate || 0,
          lateDeductionRate: usr.lateDeductionRate || 0,
          absentDeductionRate: usr.absentDeductionRate || 0,
          overtimeRateNormal: usr.overtimeRateNormal || 0,
          overtimeRateHoliday: usr.overtimeRateHoliday || 0,
          overtimeRateNational: usr.overtimeRateNational || 0,
          overtimeCalcTypeNormal: usr.overtimeCalcTypeNormal || "FIXED",
          overtimeCalcTypeHoliday: usr.overtimeCalcTypeHoliday || "FIXED",
          overtimeCalcTypeNational: usr.overtimeCalcTypeNational || "FIXED",
        };
        const loadedSelectedSites = getSelectedSitesFromUser(usr);
        const loadedSites = getSitesFromUser(usr);

        setFormData(loadedFormData);
        setSelectedSites(loadedSelectedSites);
        setSites((currentSites) => mergeSites(currentSites, loadedSites));
        setInitialFormSnapshot(
          JSON.stringify({
            formData: loadedFormData,
            selectedSites: loadedSelectedSites,
            leaveQuotas: {},
          }),
        );
      }
    } catch (error: unknown) {
      console.error("Error fetching user:", error);
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      toast.error("Gagal memuat data user: " + message);
      setErrors({ fetch: message });
    }
  }, [id]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/departments");
      if (res.ok) {
        const data = await res.json();
        // Handle both wrapped (apiSuccess) and unwrapped response formats
        const result = data.data || data;
        const depts = result.departments || result || [];
        setDepartments(Array.isArray(depts) ? depts : []);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json();
        // Handle both wrapped (apiSuccess) and unwrapped response formats
        const result = data.data || data;
        setRoles(result.roles || result || []);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  }, []);

  const fetchSites = useCallback(async () => {
    try {
      const res = await fetch("/api/sites");
      if (res.ok) {
        const data = await res.json();
        // Handle both wrapped (apiSuccess) and unwrapped response formats
        const result = data.data || data;
        const availableSites = result.sites || result || [];
        setSites((currentSites) => mergeSites(currentSites, availableSites));
      }
    } catch (error) {
      console.error("Error fetching sites:", error);
    }
  }, []);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tenants");
      if (res.ok) {
        const data = await res.json();
        setTenants(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
  }, []);

  useEffect(() => {
    const promises = [
      fetchUser(),
      fetchDepartments(),
      fetchRoles(),
      fetchSites(),
    ];

    if (canReadTenants) {
      promises.push(fetchTenants());
    }

    Promise.all(promises).finally(() => setLoading(false));
  }, [
    fetchUser,
    fetchDepartments,
    fetchRoles,
    fetchSites,
    fetchTenants,
    canReadTenants,
  ]);

  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password }));
    setShowPassword(true); // Show generated password immediately
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
      [name]: type === "checkbox" ? checked : value,
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

    if (formData.password && formData.password.length < 6) {
      newErrors.password = "Password minimal 6 karakter jika diisi";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
        departmentId: formData.departmentId || null,
        roleId: formData.roleId,
        isActive: formData.isActive,
        // Working Hours
        workingHourMode: formData.workingHourMode,
        attendanceGeofencePolicy: formData.attendanceGeofencePolicy,
        isAttendanceRequired: formData.isAttendanceRequired,
        startWorkTime: formData.startWorkTime || null,
        endWorkTime: formData.endWorkTime || null,
        workDays: formData.workDays || null,
        flexibleTargetHour: formData.flexibleTargetHour || null,
        shiftId: formData.shiftId || null,
        isSales: formData.isSales,
        canvasingTarget: formData.canvasingTarget,
        targetSchema: formData.targetSchema,
        tenantId: formData.tenantId || null,
        // Salary configuration
        basicSalary: formData.basicSalary,
        payPeriodDay: formData.payPeriodDay,
        payDay: formData.payDay,
        woIncentiveEnabled: formData.woIncentiveEnabled,
        woIncentiveRate: formData.woIncentiveRate,
        lateDeductionRate: formData.lateDeductionRate,
        absentDeductionRate: formData.absentDeductionRate,
        overtimeRateNormal: formData.overtimeRateNormal,
        overtimeRateHoliday: formData.overtimeRateHoliday,
        overtimeRateNational: formData.overtimeRateNational,
        overtimeCalcTypeNormal: formData.overtimeCalcTypeNormal,
        overtimeCalcTypeHoliday: formData.overtimeCalcTypeHoliday,
        overtimeCalcTypeNational: formData.overtimeCalcTypeNational,
        // Multi-site support
        userSites: selectedSites,
      };

      if (formData.password) {
        updateBody.password = formData.password;
      }

      const userRes = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateBody),
      });

      const userData = await userRes.json();

      if (!userRes.ok) {
        throw new Error(userData.error || "Gagal mengupdate akun user");
      }

      // Save leave quotas (if user is not FLEXIBLE and quotas were modified)
      if (
        formData.workingHourMode !== "FLEXIBLE" &&
        Object.keys(leaveQuotas).length > 0
      ) {
        try {
          await fetch("/api/admin/leave-balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: id,
              year: new Date().getFullYear(),
              quotas: leaveQuotas,
            }),
          });
        } catch (error) {
          console.error("Failed to save leave quotas:", error);
          // Don't fail the whole save just because quotas failed
        }
      }

      setShowSuccess(true);
      setTimeout(() => {
        router.push("/admin/users");
      }, 2000);
    } catch (error: unknown) {
      console.error("Error in handleSubmit:", error);
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Profile Pengguna
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Detail informasi pengguna
              </p>
            </div>
          </div>
          {canUpdate && (
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
                  {formData.name ? formData.name.charAt(0).toUpperCase() : "?"}
                </span>
              </div>
            </div>

            {/* Main Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {formData.name || "Nama Belum Diisi"}
                </h1>
                <div className="flex flex-wrap gap-3 mt-3">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                      formData.isActive
                        ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    <HiOutlineShieldCheck className="w-4 h-4 mr-1.5" />
                    {formData.isActive ? "Aktif" : "Tidak Aktif"}
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
                  <span className="font-medium">{formData.phone || "-"}</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-300 sm:col-span-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center mr-3">
                    <HiOutlineIdentification className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="font-medium">
                    {user?.role?.name || "User (Default)"}
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
              {departments.find((d) => d.id === formData.departmentId)?.name ||
                user?.departments?.name ||
                user?.department?.name ||
                "-"}
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
                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {us.isPrimary && <HiOutlineStar className="w-3.5 h-3.5" />}
                    {us.site.code} - {us.site.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xl font-medium text-gray-900 dark:text-white">
                {user?.sites
                  ? `${user.sites.code} - ${user.sites.name}`
                  : user?.site
                    ? `${user.site.code} - ${user.site.name}`
                    : "-"}
              </p>
            )}
          </div>

          {/* Tenant Card (Super Admin only) */}
          {hasPermission("tenants:read") && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <HiOutlineGlobeAlt className="w-5 h-5 text-amber-500" />
                Tenant
              </h3>
              <p className="text-xl font-medium text-gray-900 dark:text-white">
                {user?.tenant?.name || "-"}
              </p>
            </div>
          )}
        </div>

        {/* Working Hours Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <HiOutlineUserCircle className="w-5 h-5 text-blue-500" />
            Pengaturan Jam Kerja
          </h3>

          {/* Mode Badge */}
          <div className="mb-4">
            {formData.workingHourMode === "FIXED" && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <HiOutlineBuildingOffice className="w-4 h-4 mr-2" />
                Jam Kerja Tetap (FIXED)
              </span>
            )}
            {formData.workingHourMode === "SHIFT" && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <HiOutlineUserCircle className="w-4 h-4 mr-2" />
                Jam Kerja Shift (SHIFT)
              </span>
            )}
            {formData.workingHourMode === "FLEXIBLE" && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800">
                <HiOutlineUserCircle className="w-4 h-4 mr-2" />
                Jam Kerja Fleksibel (FLEXIBLE)
              </span>
            )}
          </div>

          {/* Mode Details */}
          <div className="space-y-3 text-sm">
            {formData.workingHourMode === "FIXED" && (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">
                    Jam Masuk
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formData.startWorkTime || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">
                    Jam Pulang
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formData.endWorkTime || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">
                    Hari Kerja
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formData.workDays
                      ? formData.workDays
                          .split(",")
                          .map((d) => {
                            const dayMap: Record<string, string> = {
                              Mon: "Sen",
                              Tue: "Sel",
                              Wed: "Rab",
                              Thu: "Kam",
                              Fri: "Jum",
                              Sat: "Sab",
                              Sun: "Min",
                            };
                            return dayMap[d.trim()] || d.trim();
                          })
                          .join(", ")
                      : "-"}
                  </span>
                </div>
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                  ℹ️ Jika tidak check-in pada hari kerja, akan ditandai sebagai{" "}
                  <strong>ALPHA</strong> (Tidak Masuk).
                </div>
              </>
            )}

            {formData.workingHourMode === "SHIFT" && (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">
                    Shift
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {user?.shift
                      ? user.shift.name
                      : user?.shiftId
                        ? "Shift Terpilih"
                        : "Belum dipilih"}
                  </span>
                </div>
                {user?.shift && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400">
                      Jadwal Shift
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {user.shift.startTime} - {user.shift.endTime}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">
                    Hari Kerja
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formData.workDays
                      ? formData.workDays
                          .split(",")
                          .map((d) => {
                            const dayMap: Record<string, string> = {
                              Mon: "Sen",
                              Tue: "Sel",
                              Wed: "Rab",
                              Thu: "Kam",
                              Fri: "Jum",
                              Sat: "Sab",
                              Sun: "Min",
                            };
                            return dayMap[d.trim()] || d.trim();
                          })
                          .join(", ")
                      : "-"}
                  </span>
                </div>
                <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg text-xs text-purple-700 dark:text-purple-300">
                  ℹ️ Jadwal mengikuti pola shift. Jika tidak check-in pada hari
                  kerja, akan ditandai sebagai <strong>ALPHA</strong>.
                </div>
              </>
            )}

            {formData.workingHourMode === "FLEXIBLE" && (
              <>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">
                    Target Jam Kerja
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formData.flexibleTargetHour || 8} jam / hari
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">
                    Sifat Absensi
                  </span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    Akumulasi Bulanan
                  </span>
                </div>
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg text-xs text-green-700 dark:text-green-300">
                  ✅ <strong>Tidak ada ALPHA</strong> - Bebas check-in kapan
                  saja. Yang dihitung adalah total akumulasi jam kerja dalam 1
                  bulan.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap gap-4">
          <div
            className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${formData.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"}`}
          >
            <HiOutlineShieldCheck className="w-4 h-4" />
            {formData.isActive ? "Akun Aktif" : "Akun Nonaktif"}
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

        {/* Leave Quota Summary - Only for non-FLEXIBLE users */}
        {canViewLeaveQuotas && (
          <LeaveQuotaSummary
            userId={id as string}
            workingHourMode={formData.workingHourMode}
          />
        )}

        {/* Sales Performance Stats - Only for Sales users */}
        {formData.isSales && <SalesPerformanceStats userId={id as string} />}
      </div>
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
          <div className="px-6 py-4 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
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

        {/* Organization Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-gray-200 dark:border-gray-700">
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
              </div>
            </div>
          </div>
        </div>

        {/* Working Hours Section - MOVED FROM BOTTOM */}
        <WorkingHoursSettings
          initialData={{
            workingHourMode: formData.workingHourMode,
            attendanceGeofencePolicy: formData.attendanceGeofencePolicy,
            isAttendanceRequired: formData.isAttendanceRequired,
            startWorkTime: formData.startWorkTime,
            endWorkTime: formData.endWorkTime,
            workDays: formData.workDays,
            flexibleTargetHour: formData.flexibleTargetHour,
            shiftId: formData.shiftId,
          }}
          onChange={(data) => setFormData((prev) => ({ ...prev, ...data }))}
        />

        {/* Status & Sales Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-linear-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-b border-gray-200 dark:border-gray-700">
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
                    {overtimeConfigs.map((item) => (
                      <div
                        key={item.key}
                        className={`p-3 bg-white dark:bg-gray-800 rounded-lg border border-${item.color}-100 dark:border-${item.color}-900/20`}
                      >
                        <span
                          className={`text-xs font-bold text-${item.color}-700 dark:text-${item.color}-400 block mb-2`}
                        >
                          {item.label}
                        </span>
                        <div className="space-y-2">
                          <select
                            name={item.calcTypeField}
                            value={formData[item.calcTypeField]}
                            onChange={handleChange}
                            className="w-full px-2 py-1 text-[10px] border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900/30 text-gray-900 dark:text-white"
                          >
                            <option value="PER_HOUR">Per Jam</option>
                            <option value="DAILY_SALARY">Gaji Harian</option>
                            <option value="FIXED">Tetap (Rp)</option>
                            <option value="PERCENTAGE">% Gaji Pokok</option>
                          </select>
                          <div className="relative">
                            <input
                              type="number"
                              name={item.rateField}
                              value={formData[item.rateField]}
                              onChange={handleChange}
                              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                            />
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                              Rp
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Leave Balance Settings */}
        {canManageLeaveQuotas && (
          <LeaveBalanceSettings
            userId={id}
            workingHourMode={formData.workingHourMode}
            onChange={(quotas) => {
              setLeaveQuotas(quotas);
              if (!hasLoadedLeaveQuotas && Object.keys(quotas).length === 0) {
                return;
              }
              if (!hasLoadedLeaveQuotas) {
                setHasLoadedLeaveQuotas(true);
                setInitialFormSnapshot((snapshot) => {
                  if (!snapshot) return snapshot;
                  const initialState = JSON.parse(snapshot);
                  return JSON.stringify({
                    ...initialState,
                    leaveQuotas: quotas,
                  });
                });
              }
            }}
            saveButtonLabel="Simpan Perubahan"
          />
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
          {canUpdate && (
            <button
              type="submit"
              disabled={submitting || !hasFormChanges}
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
          )}
        </div>
      </form>
    </div>
  );
}
