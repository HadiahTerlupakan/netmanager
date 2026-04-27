import bcrypt from "bcryptjs";
import type { IUserRepository } from "../domain/ports/IUserRepository";
import { createUserRepository } from "../factories/RepositoryFactory";

const PASSWORD_HASH_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;

interface UpdateAdminProfileInput {
  name?: string;
  phone?: string;
}

interface AdminProfileRelationDTO {
  id: string;
  name: string;
}

interface AdminProfileDTO {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  image: string | null;
  workingHourMode: string;
  startWorkTime: string | null;
  endWorkTime: string | null;
  workDays: string | null;
  departments: AdminProfileRelationDTO | null;
  sites: AdminProfileRelationDTO | null;
  role: AdminProfileRelationDTO | null;
}

interface AdminProfilePhotoDTO {
  id: string;
  name: string | null;
  image: string | null;
}

export class AdminProfileRouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Service untuk route profil admin. */
export class AdminProfileRouteService {
  private readonly userRepository: IUserRepository;

  constructor(userRepository: IUserRepository = createUserRepository()) {
    this.userRepository = userRepository;
  }

  /** Ambil profil admin yang sedang login. */
  async getProfile(userId: string): Promise<AdminProfileDTO> {
    const user = await this.getRequiredUser(userId);
    return this.toProfileDTO(user);
  }

  /** Update nama dan nomor telepon profil admin. */
  async updateProfile(
    userId: string,
    input: UpdateAdminProfileInput,
  ): Promise<AdminProfileDTO> {
    this.assertHasProfileUpdate(input);
    const updatedUser = await this.userRepository.update(
      userId,
      this.buildProfileUpdateData(input),
    );
    const user = await this.getRequiredUser(updatedUser.id);
    return this.toProfileDTO(user);
  }

  /** Ubah password admin setelah validasi password lama. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    this.assertNewPasswordLength(newPassword);
    const user = await this.getRequiredUser(userId);
    this.assertPasswordHash(user.passwordHash);
    await this.assertCurrentPassword(currentPassword, user.passwordHash);
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
    await this.userRepository.update(userId, { passwordHash });
  }

  /** Simpan URL foto profil admin yang baru. */
  async updatePhoto(
    userId: string,
    imageUrl: string,
  ): Promise<AdminProfilePhotoDTO> {
    const updatedUser = await this.userRepository.update(userId, {
      image: imageUrl,
    });
    return {
      id: updatedUser.id,
      name: updatedUser.name,
      image: updatedUser.image,
    };
  }

  private async getRequiredUser(userId: string) {
    const user = await this.userRepository.findByIdWithRelations(userId);
    if (user) {
      return user;
    }

    throw new AdminProfileRouteError("User tidak ditemukan", 404);
  }

  private assertHasProfileUpdate(input: UpdateAdminProfileInput): void {
    if (input.name !== undefined || input.phone !== undefined) {
      return;
    }

    throw new AdminProfileRouteError("Tidak ada field untuk diupdate", 400);
  }

  private buildProfileUpdateData(input: UpdateAdminProfileInput) {
    const updateData: { name?: string; phone?: string } = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.phone !== undefined) updateData.phone = input.phone;
    return updateData;
  }

  private assertNewPasswordLength(newPassword: string): void {
    if (newPassword.length >= MIN_PASSWORD_LENGTH) {
      return;
    }

    throw new AdminProfileRouteError("Password minimal 6 karakter", 400);
  }

  private assertPasswordHash(
    passwordHash: string | null | undefined,
  ): asserts passwordHash is string {
    if (passwordHash) {
      return;
    }

    throw new AdminProfileRouteError("User tidak ditemukan", 404);
  }

  private async assertCurrentPassword(
    currentPassword: string,
    passwordHash: string,
  ): Promise<void> {
    const isValidPassword = await bcrypt.compare(currentPassword, passwordHash);
    if (isValidPassword) {
      return;
    }

    throw new AdminProfileRouteError("Password lama salah", 400);
  }

  private toProfileDTO(
    user: Awaited<
      ReturnType<IUserRepository["findByIdWithRelations"]>
    > extends infer T
      ? Exclude<T, null>
      : never,
  ): AdminProfileDTO {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      workingHourMode: user.workingHourMode,
      startWorkTime: user.startWorkTime,
      endWorkTime: user.endWorkTime,
      workDays: user.workDays,
      departments: this.toRelationDTO(user.department),
      sites: this.toRelationDTO(user.site),
      role: this.toRelationDTO(user.role),
    };
  }

  private toRelationDTO(
    relation: { id: string; name: string } | null | undefined,
  ): AdminProfileRelationDTO | null {
    if (!relation) {
      return null;
    }

    return { id: relation.id, name: relation.name };
  }
}
