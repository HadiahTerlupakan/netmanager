import type { PrismaClient } from "@prisma/client";

const DEFAULT_TEST_CANVASING_LIMIT = 5;

export class TestCanvasingRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Find latest canvasing rows for test route responses. */
  async findLatest(limit: number = DEFAULT_TEST_CANVASING_LIMIT) {
    return this.db.canvasing.findMany({
      take: limit,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });
  }
}
