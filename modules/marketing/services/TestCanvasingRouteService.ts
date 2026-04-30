import { prisma } from "@/modules/database";
import { TestCanvasingRepository } from "../repositories/TestCanvasingRepository";

export class TestCanvasingRouteService {
  constructor(
    private readonly repository = new TestCanvasingRepository(prisma),
  ) {}

  /** Get latest canvasing records for test route responses. */
  async getLatestCanvasing(limit?: number) {
    return this.repository.findLatest(limit);
  }
}
