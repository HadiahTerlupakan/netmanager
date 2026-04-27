import type {
  CreateRegistrationData,
  Registration,
  RegistrationStatus,
  UpdateRegistrationStatusData,
} from "../entities/Registration";

export interface IRegistrationRepository {
  /** Find a registration by id. */
  findById(id: string): Promise<Registration | null>;

  /** Find all registrations ordered by creation date. */
  findAll(): Promise<Registration[]>;

  /** Find a registration by email or phone and optional status. */
  findByEmailOrPhone(
    email: string,
    phone: string,
    status?: RegistrationStatus,
  ): Promise<Registration | null>;

  /** Create a new registration entity. */
  create(data: CreateRegistrationData): Promise<Registration>;

  /** Update registration status and related audit fields. */
  updateWithDetails(
    id: string,
    data: UpdateRegistrationStatusData,
  ): Promise<Registration>;

  /** Delete a registration by id. */
  delete(id: string): Promise<void>;

  /** Read a setting value by key. */
  getSettingValue(key: string): Promise<string | null>;
}
