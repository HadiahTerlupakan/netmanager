import { describe, expect, it, vi } from "vitest";
import { JournalNumberGenerator } from "@/modules/accounting/services/journal/JournalNumberGenerator";
import type { IJournalRepository } from "@/modules/accounting/domain/ports/IJournalRepository";

describe("JournalNumberGenerator", () => {
  function createMockRepo(count: number): IJournalRepository {
    return {
      countByMonth: vi.fn().mockResolvedValue(count),
      create: vi.fn(),
      findById: vi.fn(),
      findBySource: vi.fn(),
      list: vi.fn(),
      markReversed: vi.fn(),
    } as unknown as IJournalRepository;
  }

  it("generates first entry number of the month", async () => {
    const repo = createMockRepo(0);
    const gen = new JournalNumberGenerator(repo);
    const result = await gen.generate("tenant-1", new Date("2026-05-15"));
    expect(result).toBe("JV-2026-05-0001");
    expect(repo.countByMonth).toHaveBeenCalledWith("tenant-1", 2026, 5);
  });

  it("generates sequential entry number", async () => {
    const repo = createMockRepo(42);
    const gen = new JournalNumberGenerator(repo);
    const result = await gen.generate("tenant-1", new Date("2026-12-01"));
    expect(result).toBe("JV-2026-12-0043");
  });

  it("pads month and sequence correctly", async () => {
    const repo = createMockRepo(9);
    const gen = new JournalNumberGenerator(repo);
    const result = await gen.generate("tenant-1", new Date("2026-01-20"));
    expect(result).toBe("JV-2026-01-0010");
  });
});
