import { AttendanceStatus } from '../value-objects/AttendanceStatus'

export interface AttendanceProps {
  id: string
  userId: string
  checkIn: Date
  checkInDate: Date | null
  checkOut: Date | null
  checkInPhoto: string | null
  checkOutPhoto: string | null
  status: AttendanceStatus
  notes: string | null
  location: string | null
  checkOutLocation: string | null
  geofenceStatus: string | null
  geofenceDistance: number | null
  geofenceSiteName: string | null
  checkOutGeofenceStatus: string | null
  checkOutGeofenceDistance: number | null
  geofenceMeta: Record<string, unknown> | null
  tenantId: string | null
  createdAt: Date
  updatedAt: Date
}

export class Attendance {
  private props: AttendanceProps

  constructor(props: AttendanceProps) {
    this.props = props
  }

  get id(): string { return this.props.id }
  get userId(): string { return this.props.userId }
  get checkIn(): Date { return this.props.checkIn }
  get checkInDate(): Date | null { return this.props.checkInDate }
  get checkOut(): Date | null { return this.props.checkOut }
  get checkInPhoto(): string | null { return this.props.checkInPhoto }
  get checkOutPhoto(): string | null { return this.props.checkOutPhoto }
  get status(): AttendanceStatus { return this.props.status }
  get notes(): string | null { return this.props.notes }
  get location(): string | null { return this.props.location }
  get checkOutLocation(): string | null { return this.props.checkOutLocation }
  get geofenceStatus(): string | null { return this.props.geofenceStatus }
  get geofenceDistance(): number | null { return this.props.geofenceDistance }
  get geofenceSiteName(): string | null { return this.props.geofenceSiteName }
  get checkOutGeofenceStatus(): string | null { return this.props.checkOutGeofenceStatus }
  get checkOutGeofenceDistance(): number | null { return this.props.checkOutGeofenceDistance }
  get geofenceMeta(): Record<string, unknown> | null { return this.props.geofenceMeta }
  get tenantId(): string | null { return this.props.tenantId }
  get createdAt(): Date { return this.props.createdAt }
  get updatedAt(): Date { return this.props.updatedAt }

  /**
   * Check if this attendance session is currently active (checked in but not out).
   */
  isActive(): boolean {
    return this.props.checkOut === null && !this.props.status.isAbsent()
  }

  /**
   * Check if user has already checked out.
   */
  isCheckedOut(): boolean {
    return this.props.checkOut !== null
  }

  /**
   * Calculate working hours between check-in and check-out.
   * Returns 0 if not checked out.
   */
  getWorkingHours(): number {
    if (!this.props.checkOut) return 0
    const diffMs = this.props.checkOut.getTime() - this.props.checkIn.getTime()
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100
  }

  /**
   * Perform check-out. Mutates the entity state.
   */
  checkOutNow(
    checkOutTime: Date,
    photoUrl?: string,
    location?: string,
    geofenceStatus?: string,
    geofenceDistance?: number,
    notes?: string,
  ): void {
    if (this.isCheckedOut()) {
      throw new Error('Already checked out')
    }

    this.props.checkOut = checkOutTime
    this.props.checkOutPhoto = photoUrl ?? null
    this.props.checkOutLocation = location ?? null
    this.props.checkOutGeofenceStatus = geofenceStatus ?? null
    this.props.checkOutGeofenceDistance = geofenceDistance ?? null

    if (notes) {
      this.props.notes = this.props.notes
        ? `${this.props.notes} | ${notes}`
        : notes
    }

    this.props.updatedAt = new Date()
  }

  /**
   * Mark as NO_CHECKOUT (auto-checkout).
   */
  markNoCheckout(autoCheckoutTime: Date): void {
    this.props.checkOut = autoCheckoutTime
    this.props.status = AttendanceStatus.noCheckout()
    this.props.updatedAt = new Date()
  }

  /**
   * Create a copy with updated properties.
   */
  with(updates: Partial<AttendanceProps>): Attendance {
    return new Attendance({ ...this.props, ...updates, updatedAt: new Date() })
  }

  toJSON(): AttendanceProps {
    return { ...this.props }
  }
}
