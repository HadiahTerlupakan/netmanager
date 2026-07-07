export interface AttendanceTrend {
  date: string;
  present: number;
  late: number;
}

export interface OvertimeTrend {
  date: string;
  duration: number;
}

export interface DepartmentStat {
  name: string;
  present: number;
  late: number;
  duration?: number;
}

export interface SiteStat {
  name: string;
  present: number;
  late: number;
  duration?: number;
}

export interface EmployeeSummary {
  userId: string;
  user?: {
    name: string;
    image?: string;
    site?: { name: string };
    department?: { name: string };
  };
  hadir: number;
  terlambat: number;
  izin: number;
  alpha: number;
  lemburJam: number;
  totalJamKerja: number;
}

export interface AttendanceSummary {
  totalAttendance: number;
  attendanceRate: number;
  avgDurationMinutes: number;
  lateCount: number;
  lateRate: number;
  alphaCount: number;
  alphaRate: number;
}

export interface OvertimeSummary {
  totalRequests: number;
  totalDuration: number;
  avgDuration: number;
}

export interface ReportData {
  attendance: {
    summary: AttendanceSummary;
    trends: AttendanceTrend[];
    byDepartment: DepartmentStat[];
    bySite: SiteStat[];
    employeeSummary: EmployeeSummary[];
  };
  overtime: {
    summary: OvertimeSummary;
    trends: OvertimeTrend[];
    byDepartment: DepartmentStat[];
    bySite: SiteStat[];
  };
}

export interface ReportOption {
  id: string;
  name: string;
}
