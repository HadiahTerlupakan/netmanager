import type { AnnouncementEditEntity } from "../entities/AnnouncementEntity";

export interface IAnnouncementRepository {
  /** Ambil announcement untuk form edit. */
  findEditById(id: string): Promise<AnnouncementEditEntity | null>;
}
