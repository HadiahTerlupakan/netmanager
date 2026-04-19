"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import {
  formatDateDisplay,
  formatForDateTimeInput,
  formatTimeDisplay,
} from "@/lib/utils/datetime";

type AttendanceCorrectionTarget = {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  correctedAt?: string | null;
  notes: string | null;
  user: {
    name: string | null;
    email: string;
    workingHourMode?: string | null;
    startWorkTime?: string | null;
    endWorkTime?: string | null;
    shift?: {
      startTime?: string | null;
      endTime?: string | null;
    } | null;
  };
};

type CorrectionSubmitPayload = {
  checkIn: string;
  checkOut: string | null;
  reason: string;
  notes: string | null;
  photo: File;
};

interface MissedCheckInCorrectionModalProps {
  attendance: AttendanceCorrectionTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    attendanceId: string,
    payload: CorrectionSubmitPayload,
  ) => Promise<void>;
}

type CorrectionForm = {
  checkIn: string;
  checkOut: string;
  reason: string;
  notes: string;
  photo: File | null;
};

const DEFAULT_REASON = "Karyawan hadir tetapi lupa check-in";

function resolveSchedule(attendance: AttendanceCorrectionTarget) {
  const isShiftUser = attendance.user.workingHourMode === "SHIFT";
  const startTime = isShiftUser
    ? attendance.user.shift?.startTime || attendance.user.startWorkTime || null
    : attendance.user.startWorkTime || null;
  const endTime = isShiftUser
    ? attendance.user.shift?.endTime || attendance.user.endWorkTime || null
    : attendance.user.endWorkTime || null;

  return { startTime, endTime };
}

function buildDateTimeValue(checkInValue: string, time: string): string {
  const [workDate = ""] = checkInValue.split("T");
  return workDate ? `${workDate}T${time}` : "";
}

function buildInitialForm(
  attendance: AttendanceCorrectionTarget | null,
): CorrectionForm {
  if (!attendance) {
    return {
      checkIn: "",
      checkOut: "",
      reason: DEFAULT_REASON,
      notes: "",
      photo: null,
    };
  }

  const workDate = formatForDateTimeInput(attendance.checkIn);
  const schedule = resolveSchedule(attendance);
  const defaultCheckIn = schedule.startTime
    ? buildDateTimeValue(workDate, schedule.startTime)
    : "";
  const defaultCheckOut = schedule.endTime
    ? buildDateTimeValue(workDate, schedule.endTime)
    : "";

  return {
    checkIn: defaultCheckIn,
    checkOut: attendance.checkOut
      ? formatForDateTimeInput(attendance.checkOut)
      : defaultCheckOut,
    reason: DEFAULT_REASON,
    notes: attendance.notes ?? "",
    photo: null,
  };
}

function validateForm(form: CorrectionForm): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.checkIn) {
    errors.checkIn = "Jam check-in wajib diisi";
  }

  if (form.checkOut && form.checkIn && form.checkOut < form.checkIn) {
    errors.checkOut =
      "Jam check-out harus setelah atau sama dengan jam check-in";
  }

  if (!form.reason.trim()) {
    errors.reason = "Alasan koreksi wajib diisi";
  }

  if (!form.photo) {
    errors.photo = "Foto bukti wajib diupload";
  }

  if (form.photo && !form.photo.type.startsWith("image/")) {
    errors.photo = "File bukti harus berupa gambar";
  }

  return errors;
}

export function MissedCheckInCorrectionModal({
  attendance,
  isOpen,
  onClose,
  onSubmit,
}: MissedCheckInCorrectionModalProps) {
  const [form, setForm] = useState<CorrectionForm>(() =>
    buildInitialForm(attendance),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(buildInitialForm(attendance));
    setErrors({});
    setIsSubmitting(false);
  }, [attendance, isOpen]);

  const workDateLabel = useMemo(() => {
    if (!attendance) {
      return "-";
    }

    return formatDateDisplay(attendance.checkIn, "EEEE, d MMM yyyy");
  }, [attendance]);

  const scheduleInfo = useMemo(() => {
    if (!attendance) {
      return null;
    }

    const schedule = resolveSchedule(attendance);
    if (!schedule.startTime || !schedule.endTime) {
      return null;
    }

    return schedule;
  }, [attendance]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setForm((current) => ({ ...current, photo: file }));

    if (errors.photo) {
      setErrors((current) => {
        const next = { ...current };
        delete next.photo;
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    if (!attendance) {
      return;
    }

    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(attendance.id, {
        checkIn: form.checkIn,
        checkOut: form.checkOut || null,
        reason: form.reason.trim(),
        notes: form.notes.trim() || null,
        photo: form.photo!,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (isSubmitting) return;
        onClose();
      }}
      title="Koreksi Lupa Absen"
      description="Input koreksi manual untuk record mangkir yang sebenarnya hadir."
      size="2xl"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-900/20">
          <div className="font-medium text-amber-900 dark:text-amber-200">
            {attendance?.user.name || attendance?.user.email || "-"}
          </div>
          <div className="mt-1 text-amber-800 dark:text-amber-300">
            Tanggal kerja: {workDateLabel}
          </div>
          <div className="mt-1 text-amber-700 dark:text-amber-400">
            Record sumber: {attendance?.status || "-"} · Jam awal sistem{" "}
            {attendance ? formatTimeDisplay(attendance.checkIn) : "-"}
          </div>
          <div className="mt-1 text-amber-700 dark:text-amber-400">
            Jadwal kerja:{" "}
            {scheduleInfo
              ? `${scheduleInfo.startTime} - ${scheduleInfo.endTime}`
              : "Belum disetel pada profil karyawan"}
          </div>
        </div>

        <div>
          <label
            htmlFor="missed-checkin-checkin"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Jam check-in manual
          </label>
          <input
            id="missed-checkin-checkin"
            type="datetime-local"
            value={form.checkIn}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => {
                const scheduleEndTime = attendance
                  ? resolveSchedule(attendance).endTime
                  : null;

                return {
                  ...current,
                  checkIn: value,
                  checkOut:
                    current.checkOut ||
                    (scheduleEndTime
                      ? buildDateTimeValue(value, scheduleEndTime)
                      : ""),
                };
              });
              if (errors.checkIn) {
                setErrors((current) => {
                  const next = { ...current };
                  delete next.checkIn;
                  return next;
                });
              }
            }}
            className={`w-full rounded border px-3 py-2 text-sm dark:bg-gray-700 dark:text-white ${errors.checkIn ? "border-red-500" : "dark:border-gray-600"}`}
          />
          {errors.checkIn && (
            <p className="mt-1 text-xs text-red-500">{errors.checkIn}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="missed-checkin-checkout"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Jam check-out manual
          </label>
          <input
            id="missed-checkin-checkout"
            type="datetime-local"
            value={form.checkOut}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, checkOut: value }));
              if (errors.checkOut) {
                setErrors((current) => {
                  const next = { ...current };
                  delete next.checkOut;
                  return next;
                });
              }
            }}
            className={`w-full rounded border px-3 py-2 text-sm dark:bg-gray-700 dark:text-white ${errors.checkOut ? "border-red-500" : "dark:border-gray-600"}`}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Default mengikuti jam pulang kerja karyawan yang sedang dikoreksi.
          </p>
          {errors.checkOut && (
            <p className="mt-1 text-xs text-red-500">{errors.checkOut}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="missed-checkin-reason"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Alasan koreksi
          </label>
          <input
            id="missed-checkin-reason"
            type="text"
            value={form.reason}
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                reason: event.target.value,
              }));
              if (errors.reason) {
                setErrors((current) => {
                  const next = { ...current };
                  delete next.reason;
                  return next;
                });
              }
            }}
            className={`w-full rounded border px-3 py-2 text-sm dark:bg-gray-700 dark:text-white ${errors.reason ? "border-red-500" : "dark:border-gray-600"}`}
          />
          {errors.reason && (
            <p className="mt-1 text-xs text-red-500">{errors.reason}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="missed-checkin-notes"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Catatan admin
          </label>
          <textarea
            id="missed-checkin-notes"
            rows={3}
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="missed-checkin-photo"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Foto bukti manual
          </label>
          <input
            id="missed-checkin-photo"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full rounded border px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Upload foto bukti kehadiran yang diverifikasi admin.
          </p>
          {form.photo && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              File terpilih: {form.photo.name}
            </p>
          )}
          {errors.photo && (
            <p className="mt-1 text-xs text-red-500">{errors.photo}</p>
          )}
        </div>
      </div>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Batal
        </Button>
        <Button onClick={handleSubmit} loading={isSubmitting}>
          Simpan Koreksi
        </Button>
      </ModalFooter>
    </Modal>
  );
}
