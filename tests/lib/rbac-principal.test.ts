import { describe, expect, it, vi } from "vitest";
import { resolveRbacPrincipal } from "@/lib/rbac-principal";

const SESSION_USER = { id: "u-session", role: "ADMIN" };
const BEARER_USER = { id: "u-bearer", role: "TEKNISI" };

describe("resolveRbacPrincipal", () => {
  it("memakai user eksplisit tanpa menyentuh sumber lain", async () => {
    const getSessionUser = vi.fn();
    const getBearerUser = vi.fn();

    const result = await resolveRbacPrincipal({
      explicitUser: { id: "u-explicit" },
      getSessionUser,
      getBearerUser,
    });

    expect(result).toEqual({ id: "u-explicit" });
    expect(getSessionUser).not.toHaveBeenCalled();
    expect(getBearerUser).not.toHaveBeenCalled();
  });

  it("memakai sesi NextAuth bila tersedia", async () => {
    const result = await resolveRbacPrincipal({
      getSessionUser: async () => SESSION_USER,
      getBearerUser: vi.fn(),
    });

    expect(result).toEqual(SESSION_USER);
  });

  // Regresi: hasPermission() hanya mencoba getServerSession. Untuk pemanggil
  // Bearer (token mobile) sesi itu null, sehingga fungsi selalu mengembalikan
  // false. Akibatnya pembatas cakupan `*:site_only` MATI untuk pemanggil
  // Bearer — mereka melihat data lebih luas dari yang seharusnya.
  it("jatuh ke token Bearer saat sesi tidak ada", async () => {
    const result = await resolveRbacPrincipal({
      getSessionUser: async () => null,
      getBearerUser: async () => BEARER_USER,
    });

    expect(result).toEqual(BEARER_USER);
  });

  it("mengembalikan null bila kedua sumber kosong", async () => {
    const result = await resolveRbacPrincipal({
      getSessionUser: async () => null,
      getBearerUser: async () => null,
    });

    expect(result).toBeNull();
  });

  // Kegagalan resolusi Bearer tidak boleh melempar ke pemanggil: hasPermission
  // dipakai di ratusan tempat dan harus tetap fail-closed, bukan meledak.
  it("tidak melempar saat resolusi Bearer gagal", async () => {
    const result = await resolveRbacPrincipal({
      getSessionUser: async () => null,
      getBearerUser: async () => {
        throw new Error("token rusak");
      },
    });

    expect(result).toBeNull();
  });

  it("tidak menyentuh Bearer bila sesi sudah menjawab", async () => {
    const getBearerUser = vi.fn();

    await resolveRbacPrincipal({
      getSessionUser: async () => SESSION_USER,
      getBearerUser,
    });

    expect(getBearerUser).not.toHaveBeenCalled();
  });
});
