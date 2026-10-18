/**
 * Satu karyawan yang sedang bekerja, seperti dikembalikan
 * `/api/admin/location/live`. Koordinat null berarti sesi ini belum pernah
 * mengirim titik.
 */
export interface EmployeeLocation {
  userId: string;
  userName: string;
  userImage: string | null;
  siteName: string | null;
  departmentName: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed?: number | null;
  heading?: number | null;
  isMoving: boolean;
  batteryLevel: number | null;
  recordedAt: string | null;
  checkInTime: string;
  trackingOff?: boolean;
  trackingOffSince?: string | null;
  trackingOffReason?: string | null;
}
