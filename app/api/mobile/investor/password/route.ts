import { jalankanRuteInvestorMobile } from "@/lib/mobile-investor-route";
import { getMobileInvestorAuthService } from "@/modules/investor";

/**
 * Ganti password investor dari aplikasi.
 *
 * Endpoint profil karyawan (`/api/mobile/profile/password`) menolak token
 * investor karena audience-nya berbeda, jadi investor perlu jalurnya sendiri.
 * Seluruh sesi dicabut setelah password berganti — aplikasi akan meminta
 * masuk ulang dengan password barunya.
 */
export async function POST(request: Request) {
  return jalankanRuteInvestorMobile(
    request,
    "ganti-password",
    async (session) => {
      const body = await request.json().catch(() => ({}));
      await getMobileInvestorAuthService().gantiPassword(session.id, body);
      return { message: "Password berhasil diubah" };
    },
  );
}
