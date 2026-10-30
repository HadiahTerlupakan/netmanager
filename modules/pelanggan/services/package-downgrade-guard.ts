import { prisma } from "@/modules/database";

/**
 * Menurunkan pelanggan ke paket yang lebih murah. Pelanggan sendiri hanya bisa
 * upgrade; dari admin, downgrade diatur per role lewat matriks hak akses,
 * terpisah dari `pelanggan:update` yang dimiliki staff biasa.
 */
export const IZIN_DOWNGRADE_PAKET = "pelanggan:downgrade_paket";

export const PESAN_DOWNGRADE_TANPA_IZIN =
  "Menurunkan paket pelanggan butuh izin downgrade paket. Minta pemilik izin tersebut untuk mengubahnya.";

export function bolehDowngradePaket(
  session: { user: { isSuperAdmin?: boolean | null } },
  permissions: readonly string[],
) {
  return (
    Boolean(session.user.isSuperAdmin) ||
    permissions.includes("*") ||
    permissions.includes(IZIN_DOWNGRADE_PAKET)
  );
}

/** Apakah perubahan ini menurunkan ke paket yang lebih murah tanpa izin downgrade. */
export async function isDowngradeTanpaIzin(input: {
  paketLamaId: string;
  paketBaruId: string;
  session: { user: { isSuperAdmin?: boolean | null } };
  permissions: readonly string[];
}) {
  if (input.paketLamaId === input.paketBaruId) return false;
  if (bolehDowngradePaket(input.session, input.permissions)) return false;

  const harga = async (id: string) =>
    (
      await prisma.hargaPaket.findUnique({
        where: { id },
        select: { harga: true },
      })
    )?.harga;
  const [hargaLama, hargaBaru] = await Promise.all([
    harga(input.paketLamaId),
    harga(input.paketBaruId),
  ]);
  return (
    hargaLama !== undefined && hargaBaru !== undefined && hargaBaru < hargaLama
  );
}
