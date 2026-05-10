import {
  differenceInHours,
  addHours,
  addDays,
  setHours,
  setMinutes,
} from "date-fns";

export type TimelineCategory = "mendadak" | "normal" | "advance";

export interface TimelineSettings {
  enableTimelineAutoReject: boolean;
  // Mendadak (< 24h)
  mendadakDeadlineHours: number;
  mendadakReminder1Hours: number;
  mendadakReminder2Hours: number;
  // Normal (1-7 days)
  normalDeadlineDays: number;
  normalReminder1Days: number;
  normalReminder2Days: number;
  // Advance (> 7 days)
  advanceDeadlineDays: number;
  advanceReminder1Days: number;
  advanceReminder2Days: number;
  advanceReminder3Days: number;
}

const DEFAULT_TIMELINE_SETTINGS: TimelineSettings = {
  enableTimelineAutoReject: true,
  mendadakDeadlineHours: 8,
  mendadakReminder1Hours: 4,
  mendadakReminder2Hours: 6,
  normalDeadlineDays: 1,
  normalReminder1Days: 3,
  normalReminder2Days: 2,
  advanceDeadlineDays: 1,
  advanceReminder1Days: 7,
  advanceReminder2Days: 3,
  advanceReminder3Days: 1,
};

/** Service untuk menangani timeline-based auto-reject logic. */
export class LeaveTimelineService {
  /**
   * Tentukan kategori timeline berdasarkan waktu submit dan start date.
   * - mendadak: < 24 jam
   * - normal: 1-7 hari
   * - advance: > 7 hari
   */
  determineCategory(submittedAt: Date, startDate: Date): TimelineCategory {
    const hoursUntilStart = differenceInHours(startDate, submittedAt);

    if (hoursUntilStart < 24) {
      return "mendadak";
    }

    if (hoursUntilStart < 24 * 7) {
      return "normal";
    }

    return "advance";
  }

  /**
   * Hitung deadline untuk approval berdasarkan kategori.
   * - mendadak: submittedAt + X hours atau H-1 17:00 (mana yang lebih dulu)
   * - normal: H-1 17:00
   * - advance: H-1 17:00
   */
  calculateDeadline(
    category: TimelineCategory,
    submittedAt: Date,
    startDate: Date,
    settings: TimelineSettings = DEFAULT_TIMELINE_SETTINGS,
  ): Date {
    if (category === "mendadak") {
      // Deadline: submittedAt + X hours ATAU H-1 17:00 (mana yang lebih dulu)
      const deadlineFromSubmit = addHours(
        submittedAt,
        settings.mendadakDeadlineHours,
      );
      const dayBeforeStart = addDays(startDate, -1);
      const deadlineH1_17 = setMinutes(setHours(dayBeforeStart, 17), 0);

      // Pilih yang lebih dulu
      return deadlineFromSubmit < deadlineH1_17
        ? deadlineFromSubmit
        : deadlineH1_17;
    }

    // Normal & Advance: H-1 17:00
    const daysBeforeStart =
      category === "normal"
        ? settings.normalDeadlineDays
        : settings.advanceDeadlineDays;

    const dayBeforeStart = addDays(startDate, -daysBeforeStart);
    return setMinutes(setHours(dayBeforeStart, 17), 0);
  }

  /**
   * Tentukan waktu-waktu reminder berdasarkan kategori.
   * Returns array of Date untuk setiap reminder stage.
   */
  determineReminders(
    category: TimelineCategory,
    submittedAt: Date,
    startDate: Date,
    settings: TimelineSettings = DEFAULT_TIMELINE_SETTINGS,
  ): Date[] {
    const reminders: Date[] = [];

    if (category === "mendadak") {
      // Reminder 1: submittedAt + X hours
      reminders.push(addHours(submittedAt, settings.mendadakReminder1Hours));

      // Reminder 2: submittedAt + Y hours
      reminders.push(addHours(submittedAt, settings.mendadakReminder2Hours));
    } else if (category === "normal") {
      // Reminder 1: H-3
      reminders.push(
        setMinutes(
          setHours(addDays(startDate, -settings.normalReminder1Days), 9),
          0,
        ),
      );

      // Reminder 2: H-2
      reminders.push(
        setMinutes(
          setHours(addDays(startDate, -settings.normalReminder2Days), 9),
          0,
        ),
      );
    } else {
      // advance
      // Reminder 1: H-7
      reminders.push(
        setMinutes(
          setHours(addDays(startDate, -settings.advanceReminder1Days), 9),
          0,
        ),
      );

      // Reminder 2: H-3
      reminders.push(
        setMinutes(
          setHours(addDays(startDate, -settings.advanceReminder2Days), 9),
          0,
        ),
      );

      // Reminder 3: H-1
      reminders.push(
        setMinutes(
          setHours(addDays(startDate, -settings.advanceReminder3Days), 9),
          0,
        ),
      );
    }

    return reminders;
  }

  /**
   * Check apakah leave request sudah melewati deadline dan harus auto-reject.
   */
  checkShouldAutoReject(
    submittedAt: Date,
    startDate: Date,
    now: Date,
    settings: TimelineSettings = DEFAULT_TIMELINE_SETTINGS,
  ): boolean {
    if (!settings.enableTimelineAutoReject) {
      return false;
    }

    const category = this.determineCategory(submittedAt, startDate);
    const deadline = this.calculateDeadline(
      category,
      submittedAt,
      startDate,
      settings,
    );

    return now >= deadline;
  }

  /**
   * Tentukan reminder stage mana yang harus dikirim sekarang.
   * Returns "first" | "second" | "final" | null
   */
  determineReminderStage(
    submittedAt: Date,
    startDate: Date,
    now: Date,
    firstReminderSentAt: Date | null,
    secondReminderSentAt: Date | null,
    finalReminderSentAt: Date | null,
    settings: TimelineSettings = DEFAULT_TIMELINE_SETTINGS,
  ): "first" | "second" | "final" | null {
    const category = this.determineCategory(submittedAt, startDate);
    const reminders = this.determineReminders(
      category,
      submittedAt,
      startDate,
      settings,
    );

    // Check reminder 1
    if (!firstReminderSentAt && reminders[0] && now >= reminders[0]) {
      return "first";
    }

    // Check reminder 2
    if (!secondReminderSentAt && reminders[1] && now >= reminders[1]) {
      return "second";
    }

    // Check reminder 3 (hanya untuk advance)
    if (
      category === "advance" &&
      !finalReminderSentAt &&
      reminders[2] &&
      now >= reminders[2]
    ) {
      return "final";
    }

    // Untuk mendadak & normal, reminder 2 adalah final
    if (
      category !== "advance" &&
      !finalReminderSentAt &&
      reminders[1] &&
      now >= reminders[1]
    ) {
      return "final";
    }

    return null;
  }
}
