/** Satu karyawan aktif seperti dikembalikan `/api/admin/location/live`. */
export interface EmployeeLocation {
  userId: string;
  userName: string;
  userImage: string | null;
  siteName: string | null;
  departmentName: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed?: number | null;
  heading?: number | null;
  isMoving: boolean;
  batteryLevel: number | null;
  recordedAt: string;
  checkInTime: string;
}
