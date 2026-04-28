import { prisma } from "@/modules/database";
import type { IAnnouncementRepository } from "../domain/ports/IAnnouncementRepository";

export class AnnouncementRepository implements IAnnouncementRepository {
  /** Ambil announcement untuk form edit. */
  findEditById(id: string) {
    return prisma.announcement.findUnique({ where: { id } });
  }
}
