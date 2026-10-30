import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/registration/repositories/RegistrationRepository", () => ({
  RegistrationRepository: class {},
}));

import { RegistrationService } from "@/modules/registration/services/RegistrationService";

const input = (email: string) =>
  ({
    name: "Budi",
    email,
    phone: "081200000000",
    address: "Jl. Contoh 1",
  }) as never;

describe("RegistrationService email check", () => {
  it("rejects an oversized email without scanning it", async () => {
    const repository = { findByEmailOrPhone: vi.fn() };
    const service = new RegistrationService(repository as never);
    // The public form posts straight here; this input took ~0.9 s on the old
    // regex and grows quadratically with length.
    const email = `a@${".".repeat(40_000)}@`;

    const started = performance.now();
    const result = await service.register(input(email));
    const elapsed = performance.now() - started;

    expect(result).toMatchObject({ success: false, statusCode: 400 });
    expect(repository.findByEmailOrPhone).not.toHaveBeenCalled();
    expect(elapsed).toBeLessThan(50);
  });

  it("still accepts an ordinary email", async () => {
    const repository = {
      findByEmailOrPhone: vi.fn(async () => ({ id: "existing" })),
    };
    const service = new RegistrationService(repository as never);

    const result = await service.register(input("budi@contoh.id"));

    // Reaching the duplicate lookup means the email passed validation.
    expect(repository.findByEmailOrPhone).toHaveBeenCalled();
    expect(result).toMatchObject({ success: false, statusCode: 409 });
  });
});
