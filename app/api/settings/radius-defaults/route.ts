import { NextResponse } from 'next/server';

/**
 * GET /api/settings/radius-defaults
 * 
 * Mengembalikan konfigurasi default RADIUS dari environment variables.
 * Digunakan oleh form add/edit MikroTik agar port dan IP 
 * otomatis sesuai deployment (Docker/K8s).
 * 
 * Env vars:
 * - RADIUS_AUTH_PORT: External auth port (default: 1812)
 * - RADIUS_ACCT_PORT: External acct port (default: 1813)
 */
export async function GET() {
    return NextResponse.json({
        authPort: Number(process.env.RADIUS_AUTH_PORT) || 1812,
        accountingPort: Number(process.env.RADIUS_ACCT_PORT) || 1813,
    });
}
