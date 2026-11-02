export interface UserSchedule {
  userId: string;
  userName: string | null;
  startWorkTime: string;
  endWorkTime: string;
  workDays: string | null;
  /** Punya token FCM — HP-nya bisa menerima push pengingat. */
  hasPushDevice: boolean;
  phone: string | null;
}

export interface ReminderResult {
  [key: string]: unknown;
  usersNotified: number;
  details: string[];
}

export interface FixedAlphaResult {
  [key: string]: unknown;
  usersMarkedAlpha: number;
  details: string[];
}
