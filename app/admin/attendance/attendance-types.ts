export interface Attendance {
  id: string;
  checkIn: string;
  checkOut: string | null;
  checkInPhoto: string | null;
  checkOutPhoto: string | null;
  checkOutLocation: string | null;
  status: string;
  displayStatus?: string | null;
  notes: string | null;
  location: string | null;
  correctedAt?: string | null;
  correctionReason?: string | null;
  correctionReplacementAttendanceId?: string | null;
  correctionSourceAttendanceId?: string | null;
  correctionSource?: string | null;
  user: {
    name: string | null;
    email: string;
    image: string | null;
    workingHourMode?: string | null;
    startWorkTime?: string | null;
    endWorkTime?: string | null;
    shift?: {
      startTime?: string | null;
      endTime?: string | null;
    } | null;
    departments: {
      name: string;
    } | null;
    sites?: {
      name: string;
    } | null;
  };
}

export interface AttendanceOption {
  id: string;
  name: string;
}
