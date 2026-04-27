export interface LocationDataEntity {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  isMoving?: boolean;
  recordedAt?: Date;
}

export interface EmployeeLocationEntity {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude?: number | null;
  speed: number | null;
  heading: number | null;
  batteryLevel: number | null;
  isMoving: boolean;
  recordedAt: Date;
}
