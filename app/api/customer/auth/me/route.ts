import { NextRequest } from "next/server";
import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { getCustomerPortalService } from "@/modules/pelanggan";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const { session } = authResult;
    const customerPortalService = getCustomerPortalService();

    // Get full customer data
    const customer = await customerPortalService.getCustomerWithPackage(
      session.id,
    );

    if (!customer) {
      return apiError("Data pelanggan tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    // Return customer profile
    return apiSuccess({
      customer: {
        id: customer.id,
        idPelanggan: customer.idPelanggan,
        nama: customer.nama,
        username: customer.username,
        email: customer.email,
        noTelp: customer.noTelp,
        alamat: customer.alamat,
        status: customer.status,
        tipe: customer.tipe,
        tanggalAktif: customer.tanggalAktif,
        jatuhTempo: customer.jatuhTempo,
        paket: customer.hargaPaket
          ? {
              id: customer.hargaPaket.id,
              nama: customer.hargaPaket.name,
              harga: customer.hargaPaket.harga,
              kecepatan: customer.hargaPaket.description,
            }
          : null,
        lokasi: {
          provinsi: customer.provinsi,
          kabupatenKota: customer.kabupatenKota,
          kecamatan: customer.kecamatan,
          kelurahanDesa: customer.kelurahanDesa,
          latitude: customer.latitude,
          longitude: customer.longitude,
        },
      },
    });
  } catch (error) {
    console.error("[Customer Me Error]:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
