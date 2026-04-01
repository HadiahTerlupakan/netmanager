import { GeoCoordinate } from './GeoCoordinate'

export interface CheckOutRequestProps {
  userId: string
  tenantId?: string
  photoUrl?: string
  location?: string
  notes?: string
  latitude?: number
  longitude?: number
  offlineTime?: string
  timezone?: string
  idempotencyKey?: string
}

export class CheckOutRequest {
  public readonly userId: string
  public readonly tenantId?: string
  public readonly photoUrl?: string
  public readonly location?: string
  public readonly notes?: string
  public readonly coordinate?: GeoCoordinate
  public readonly offlineTime?: Date
  public readonly timezone: string
  public readonly idempotencyKey?: string

  constructor(props: CheckOutRequestProps) {
    this.userId = props.userId
    this.tenantId = props.tenantId
    this.photoUrl = props.photoUrl
    this.location = props.location
    this.notes = props.notes
    this.timezone = props.timezone ?? 'Asia/Jakarta'
    this.idempotencyKey = props.idempotencyKey

    if (props.latitude != null && props.longitude != null) {
      this.coordinate = new GeoCoordinate(props.latitude, props.longitude)
    }

    if (props.offlineTime) {
      this.offlineTime = new Date(props.offlineTime)
      if (isNaN(this.offlineTime.getTime())) {
        throw new Error('Invalid offline time')
      }
    }
  }

  hasGeoLocation(): boolean {
    return this.coordinate != null
  }

  getEffectiveTime(): Date {
    return this.offlineTime ?? new Date()
  }

  validate(): string[] {
    const errors: string[] = []
    if (!this.userId || this.userId.trim() === '') {
      errors.push('userId is required')
    }
    return errors
  }
}
