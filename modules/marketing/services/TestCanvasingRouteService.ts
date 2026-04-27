import { prisma } from "@/modules/database";

const DEFAULT_LIMIT = 5;

export class TestCanvasingRouteService {
  /** Get latest canvasing records for test route responses. */
  async getLatestCanvasing(limit: number = DEFAULT_LIMIT) {
    return prisma.canvasing.findMany({
      take: limit,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });
  }
}
