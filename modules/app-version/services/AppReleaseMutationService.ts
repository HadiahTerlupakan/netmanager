import type { AppRelease } from "../domain/entities/AppReleaseEntity";
import type {
  AppReleaseCreateInput,
  AppReleaseUpdateInput,
  IAppReleaseRepository,
} from "../domain/ports/IAppReleaseRepository";
import { AppReleaseNotFoundError } from "../errors";

export class AppReleaseMutationService {
  constructor(private readonly repository: IAppReleaseRepository) {}

  async create(
    data: AppReleaseCreateInput,
    createdBy: string,
  ): Promise<AppRelease> {
    return this.repository.create({ ...data, createdBy });
  }

  async update(id: string, data: AppReleaseUpdateInput): Promise<AppRelease> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppReleaseNotFoundError(id);
    }
    return this.repository.update(id, data);
  }

  async deactivate(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppReleaseNotFoundError(id);
    }
    await this.repository.delete(id);
  }
}
