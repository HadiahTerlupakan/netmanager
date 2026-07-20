"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  HiArrowPath,
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { clientLogger } from "@/lib/client-logger";
import { usePermission } from "@/hooks/use-permission";
import type { UserDetailDTO } from "@/modules/users";
import { OrganizationSection } from "@/app/admin/hr/_components/OrganizationSection";
import WorkingHoursSettings from "@/app/admin/hr/_components/WorkingHoursSettings";
import LeaveBalanceSettings from "@/app/admin/hr/_components/LeaveBalanceSettings";
import {
  fetchAdminUserDetail,
  fetchDepartments,
  fetchActiveSites,
  updateAdminUser,
  saveLeaveQuotas,
  type ReferenceDepartment,
  type ReferenceSite,
} from "@/app/admin/hr/lib/hrEmployeeApi";
import {
  getSelectedSitesFromUser,
  getSitesFromUser,
  mergeSites,
} from "@/app/admin/hr/lib/siteHelpers";
import {
  DEFAULT_HR_FORM,
  buildHrUpdateBody,
  flexibleTargetAsNumber,
  toHrForm,
  type HrFormData,
  type SelectedSite,
} from "./hrDetailForm";

// allow: SIZE_OK — single HR detail form UI + load/submit; helpers in hrDetailForm.ts

/** Detail kepegawaian HR: penempatan, jam kerja, kuota cuti (tanpa akun/role). */
export function HrEmployeeDetailClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("users:update");
  const canManageLeaveQuotas =
    hasPermission("users:update") || hasPermission("attendance:update");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [user, setUser] = useState<UserDetailDTO | null>(null);
  const [departments, setDepartments] = useState<ReferenceDepartment[]>([]);
  const [sites, setSites] = useState<ReferenceSite[]>([]);
  const [selectedSites, setSelectedSites] = useState<SelectedSite[]>([]);
  const [formData, setFormData] = useState<HrFormData>(DEFAULT_HR_FORM);
  const [leaveQuotas, setLeaveQuotas] = useState<Record<string, number>>({});
  const [hasLoadedLeaveQuotas, setHasLoadedLeaveQuotas] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const hasFormChanges =
    initialSnapshot !== "" &&
    JSON.stringify({ formData, selectedSites, leaveQuotas }) !==
      initialSnapshot;

  const loadData = useCallback(async () => {
    try {
      const [usr, depts, activeSites] = await Promise.all([
        fetchAdminUserDetail(id),
        fetchDepartments(),
        fetchActiveSites(),
      ]);
      setDepartments(depts);
      if (!usr) {
        setSites(activeSites);
        setErrors({ fetch: "Data pegawai tidak ditemukan" });
        return;
      }
      setUser(usr);
      const loadedForm = toHrForm(usr);
      const loadedSites = getSelectedSitesFromUser(usr);
      setFormData(loadedForm);
      setSelectedSites(loadedSites);
      setSites(mergeSites(activeSites, getSitesFromUser(usr)));
      setInitialSnapshot(
        JSON.stringify({
          formData: loadedForm,
          selectedSites: loadedSites,
          leaveQuotas: {},
        }),
      );
    } catch (error: unknown) {
      clientLogger.error("Error fetching HR employee:", error);
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      toast.error("Gagal memuat data pegawai: " + message);
      setErrors({ fetch: message });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(t);
  }, [loadData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLeaveQuotasChange = (quotas: Record<string, number>) => {
    setLeaveQuotas(quotas);
    if (!hasLoadedLeaveQuotas && Object.keys(quotas).length === 0) return;
    if (hasLoadedLeaveQuotas) return;
    setHasLoadedLeaveQuotas(true);
    setInitialSnapshot((s) =>
      s ? JSON.stringify({ ...JSON.parse(s), leaveQuotas: quotas }) : s,
    );
  };

  const handleSubmit: React.ComponentProps<"form">["onSubmit"] = async (e) => {
    e?.preventDefault();
    if (!hasFormChanges) {
      setErrors({ submit: "Belum ada perubahan untuk disimpan" });
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      await updateAdminUser(id, buildHrUpdateBody(formData, selectedSites));
      if (
        formData.workingHourMode !== "FLEXIBLE" &&
        Object.keys(leaveQuotas).length > 0
      ) {
        try {
          await saveLeaveQuotas(id, leaveQuotas);
        } catch (err) {
          clientLogger.error("Failed to save leave quotas:", err);
          setErrors({
            submit:
              "Data kepegawaian tersimpan, tetapi kuota cuti gagal diperbarui",
          });
          setSubmitting(false);
          return;
        }
      }
      setShowSuccess(true);
      setTimeout(() => router.push("/admin/hr/employees"), 2000);
    } catch (error: unknown) {
      clientLogger.error("Error in HR employee submit:", error);
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Gagal memperbarui data kepegawaian",
      });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center min-h-64 items-center">
        <HiArrowPath className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }
  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-2">
        <HiOutlineCheckCircle className="w-10 h-10 text-green-600" />
        <p className="text-gray-700 dark:text-gray-300">
          Data kepegawaian telah diperbarui
        </p>
      </div>
    );
  }
  if (errors.fetch && !user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-red-600 dark:text-red-400">{errors.fetch}</p>
        <Link
          href="/admin/hr/employees"
          className="text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Kembali ke daftar pegawai
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/hr/employees"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
        >
          <HiOutlineArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
            {user?.name || "Pegawai"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 truncate">
            {user?.email}
          </p>
        </div>
        <Link
          href={`/admin/users/${id}`}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
        >
          Ke akun Pengguna →
        </Link>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <OrganizationSection
          departments={departments}
          sites={sites}
          selectedSites={selectedSites}
          setSelectedSites={setSelectedSites}
          formData={{ departmentId: formData.departmentId }}
          handleChange={handleChange}
        />
        <WorkingHoursSettings
          initialData={{
            workingHourMode: formData.workingHourMode,
            attendanceGeofencePolicy: formData.attendanceGeofencePolicy,
            isAttendanceRequired: formData.isAttendanceRequired,
            startWorkTime: formData.startWorkTime,
            endWorkTime: formData.endWorkTime,
            workDays: formData.workDays,
            flexibleTargetHour: flexibleTargetAsNumber(
              formData.flexibleTargetHour,
            ),
            shiftId: formData.shiftId,
          }}
          onChange={(data) => setFormData((prev) => ({ ...prev, ...data }))}
        />
        {canManageLeaveQuotas && (
          <LeaveBalanceSettings
            userId={id}
            workingHourMode={formData.workingHourMode}
            onChange={handleLeaveQuotasChange}
            saveButtonLabel="Simpan Perubahan"
          />
        )}
        {errors.submit && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
            <HiOutlineExclamationTriangle className="w-6 h-6 text-red-500 shrink-0" />
            <p className="text-red-700 dark:text-red-300">{errors.submit}</p>
          </div>
        )}
        <div className="flex justify-end gap-4">
          <Link
            href="/admin/hr/employees"
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
          >
            Batal
          </Link>
          {canUpdate && (
            <button
              type="submit"
              disabled={submitting || !hasFormChanges}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg disabled:opacity-50"
            >
              {submitting ? (
                <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
              ) : (
                <HiOutlineCheckCircle className="w-5 h-5" />
              )}
              {submitting ? "Menyimpan..." : "Simpan"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
