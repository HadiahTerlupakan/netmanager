import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MootaProvider } from "@/modules/finance/services/payment-gateway/providers/moota-provider";
import { MidtransProvider } from "@/modules/finance/services/payment-gateway/providers/midtrans-provider";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { provider, apiKey, clientKey, isProduction } = body;

        let isConnected = false;
        let message = "Provider not implemented for testing yet.";

        if (provider === 'MOOTA') {
            const moota = new MootaProvider();
            moota.initialize({
                apiKey: apiKey || '',
                isProduction: isProduction || false
            });
            const result = await moota.testConnection();
            isConnected = result.success;
            message = isConnected ? "Berhasil terhubung ke Moota API." : "Gagal terhubung ke Moota API. Pastikan API Key benar.";
        }
        else if (provider === 'MIDTRANS') {
            const midtrans = new MidtransProvider();
            midtrans.initialize({
                isProduction: isProduction || false,
                apiKey: apiKey || '',
                clientKey: clientKey || ''
            });
            const result = await midtrans.testConnection();
            isConnected = result.success;
            message = isConnected ? "Berhasil terhubung ke Midtrans API." : "Gagal terhubung ke Midtrans API. Pastikan Server Key benar.";
        }
        else {
            // For others, just pretend success for now as we don't have implementations mapped
            isConnected = true;
            message = `Simulasi tes koneksi sukses untuk ${provider}. (Belum ada implementasi test aktual)`;
        }

        return NextResponse.json({ success: isConnected, message });

    } catch (error: unknown) {
        console.error("Test connection error:", error);
        const err = error as Record<string, unknown>;
        return NextResponse.json({
            success: false,
            message: (err?.message as string) || "Terjadi kesalahan internal saat mengetes koneksi."
        }, { status: 500 });
    }
}
