/**
 * Holiday Notification Helpers
 * Helper functions untuk build notification data saat holiday dibuat
 */

export type HolidayNotificationData = {
  holidayId: string;
  holidayName: string;
  holidayDate: Date;
  holidayType: string;
  description?: string;
  tenantId: string;
};

export function buildHolidayNotificationTitle(): string {
  return "🎉 Libur Baru Ditambahkan";
}

export function buildHolidayNotificationMessage(
  name: string,
  date: Date,
  description?: string,
): string {
  const formattedDate = date.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let message = `${name} - ${formattedDate}`;
  if (description) {
    message += `\n${description}`;
  }

  return message;
}

export function buildHolidayNotificationLink(): string {
  return "/employee/holidays";
}
