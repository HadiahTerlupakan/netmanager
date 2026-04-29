interface TukarLiburValidationInput {
  userId: string;
  tenantId: string;
  startDate: Date;
  replacementDate?: Date;
  workDays: string | null;
}

interface TukarLiburValidationDependencies {
  isHoliday: (
    date: Date,
    tenantId: string,
  ) => Promise<{ isHoliday: boolean } | boolean>;
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getWeekdayName = (date: Date) => WEEKDAY_NAMES[date.getDay()];

const parseWorkDays = (workDays: string | null) =>
  workDays
    ? workDays
        .split(",")
        .map((day) => day.trim())
        .filter(Boolean)
    : [];

export async function validateTukarLiburRules(
  input: TukarLiburValidationInput,
  dependencies: TukarLiburValidationDependencies,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!input.replacementDate) {
    return {
      success: false,
      error: "Tanggal pengganti wajib diisi untuk Tukar Libur",
    };
  }

  const workDays = parseWorkDays(input.workDays);
  if (workDays.length === 0) {
    return {
      success: false,
      error: "Jadwal hari kerja tidak valid untuk Tukar Libur",
    };
  }

  const startDayName = getWeekdayName(input.startDate);
  const startDateKey = input.startDate.toISOString().split("T")[0];
  if (!workDays.includes(startDayName)) {
    return {
      success: false,
      error: `Tanggal izin (${startDateKey}) harus merupakan Hari Kerja.`,
    };
  }

  const replacementDayName = getWeekdayName(input.replacementDate);
  const replacementDateKey = input.replacementDate.toISOString().split("T")[0];
  const isOffDay = !workDays.includes(replacementDayName);
  const holidayResult = await dependencies.isHoliday(
    input.replacementDate,
    input.tenantId,
  );
  const isHoliday =
    typeof holidayResult === "boolean"
      ? holidayResult
      : holidayResult.isHoliday;

  if (!isOffDay && !isHoliday) {
    return {
      success: false,
      error: `Tanggal pengganti (${replacementDateKey}) harus merupakan Hari Libur atau Tanggal Merah.`,
    };
  }

  return { success: true };
}
