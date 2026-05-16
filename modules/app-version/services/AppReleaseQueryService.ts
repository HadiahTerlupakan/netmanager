import type { AppRelease } from "../domain/entities/AppReleaseEntity";
import type {
  AppReleaseQueryFilters,
  IAppReleaseRepository,
} from "../domain/ports/IAppReleaseRepository";
import { AppReleaseNotFoundError } from "../errors";

export class AppReleaseQueryService {
  constructor(private readonly repository: IAppReleaseRepository) {}

  async list(filters: AppReleaseQueryFilters) {
    const [items, total] = await Promise.all([
      this.repository.findAll(filters),
      this.repository.count(filters),
    ]);
    return { items, total };
  }

  async getById(id: string): Promise<AppRelease> {
    const release = await this.repository.findById(id);
    if (!release) {
      throw new AppReleaseNotFoundError(id);
    }
    return release;
  }
}
