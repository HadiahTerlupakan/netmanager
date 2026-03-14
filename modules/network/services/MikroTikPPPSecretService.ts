/**
 * MikroTik PPP Secret Service
 * 
 * Mengelola PPP Secret di MikroTik Router untuk pelanggan PPP.
 * Digunakan dalam mode API MikroTik (bukan RADIUS).
 */

import { RouterOSAPI } from 'node-routeros-v2';
import { prisma as defaultPrisma } from '@/lib/prisma';

type PrismaInstance = typeof defaultPrisma;

interface PPPSecretData {
  name: string;
  password: string;
  profile: string;
  service?: string;
  comment?: string;
  disabled?: boolean;
}

interface RouterConfig {
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
}

const EXPIRED_PROFILE = 'expired users';
const CONNECTION_TIMEOUT = 10000;

export class MikroTikPPPSecretService {
  constructor(private prisma: PrismaInstance = defaultPrisma) {}

  /**
   * Helper: Connect ke MikroTik Router
   */
  private async connectToRouter(config: RouterConfig): Promise<RouterOSAPI> {
    const conn = new RouterOSAPI({
      host: config.ipAddress,
      port: config.apiPort,
      user: config.apiUsername,
      password: config.apiPassword,
      timeout: CONNECTION_TIMEOUT,
    });
    await conn.connect();
    return conn;
  }

  /**
   * Helper: Get router config dari pelanggan
   * Menggunakan generated API user jika tersedia, fallback ke master user
   */
  private async getRouterFromPelanggan(pelangganId: string): Promise<{
    router: RouterConfig;
    routerId: string;
    pelanggan: {
      username: string;
      password: string;
      nama: string;
    };
    profileName: string;
  } | null> {
    const pelanggan = await this.prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      include: {
        hargaPaket: {
          include: {
            profilePPP: {
              include: { mikroTikRouter: true }
            }
          }
        }
      }
    });

    if (!pelanggan?.hargaPaket?.profilePPP?.mikroTikRouter) {
      return null;
    }

    const router = pelanggan.hargaPaket.profilePPP.mikroTikRouter;
    
    // Gunakan generated API user jika tersedia, fallback ke master user
    const apiUsername = router.apiUsernameGenerated || router.apiUsername;
    const apiPassword = router.apiPasswordGenerated || router.apiPassword;
    
    return {
      router: {
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: apiUsername,
        apiPassword: apiPassword,
      },
      routerId: router.id,
      pelanggan,
      profileName: pelanggan.hargaPaket.profilePPP.name,
    };
  }

  /**
   * Buat PPP Secret di MikroTik
   */
  async createSecret(
    routerId: string,
    data: PPPSecretData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const router = await this.prisma.mikroTikRouter.findUnique({
        where: { id: routerId }
      });

      if (!router) {
        return { success: false, error: 'Router tidak ditemukan' };
      }

      const conn = await this.connectToRouter({
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: router.apiUsernameGenerated || router.apiUsername,
        apiPassword: router.apiPasswordGenerated || router.apiPassword,
      });

      try {
        // Cek apakah secret sudah ada
        const existing = await conn.write('/ppp/secret/print', [
          `?name=${data.name}`
        ]) as Array<Record<string, string>>;

        if (existing && existing.length > 0) {
          // Update jika sudah ada
          const secret = existing[0];
          if (secret) {
            await conn.write('/ppp/secret/set', [
              `=.id=${secret['.id']}`,
              `=password=${data.password}`,
              `=profile=${data.profile}`,
              `=comment=${data.comment || 'added by netmanager'}`,
            ]);
          }
        } else {
          // Buat baru
          await conn.write('/ppp/secret/add', [
            `=name=${data.name}`,
            `=password=${data.password}`,
            `=profile=${data.profile}`,
            `=service=${data.service || 'pppoe'}`,
            `=comment=${data.comment || 'added by netmanager'}`,
          ]);
        }

        conn.close();
        return { success: true };
      } catch (error: unknown) {
        conn.close();
        throw error;
      }
    } catch (error: unknown) {
      console.error('[PPPSecretService] createSecret error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update PPP Secret profile
   */
  async setSecretProfile(
    routerId: string,
    username: string,
    profileName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const router = await this.prisma.mikroTikRouter.findUnique({
        where: { id: routerId }
      });

      if (!router) {
        return { success: false, error: 'Router tidak ditemukan' };
      }

      const conn = await this.connectToRouter({
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: router.apiUsernameGenerated || router.apiUsername,
        apiPassword: router.apiPasswordGenerated || router.apiPassword,
      });

      try {
        const secrets = await conn.write('/ppp/secret/print', [
          `?name=${username}`
        ]) as Array<Record<string, string>>;

        if (!secrets || secrets.length === 0 || !secrets[0]) {
          conn.close();
          return { success: false, error: 'PPP Secret tidak ditemukan' };
        }

        await conn.write('/ppp/secret/set', [
          `=.id=${secrets[0]['.id']}`,
          `=profile=${profileName}`,
        ]);

        conn.close();
        return { success: true };
      } catch (error: unknown) {
        conn.close();
        throw error;
      }
    } catch (error: unknown) {
      console.error('[PPPSecretService] setSecretProfile error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Disconnect active PPPoE session
   */
  async disconnectSession(
    routerId: string,
    username: string
  ): Promise<{ success: boolean; disconnected: number; error?: string }> {
    try {
      const router = await this.prisma.mikroTikRouter.findUnique({
        where: { id: routerId }
      });

      if (!router) {
        return { success: false, disconnected: 0, error: 'Router tidak ditemukan' };
      }

      const conn = await this.connectToRouter({
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: router.apiUsernameGenerated || router.apiUsername,
        apiPassword: router.apiPasswordGenerated || router.apiPassword,
      });

      try {
        // Cari active sessions
        const sessions = await conn.write('/ppp/active/print', [
          `?name=${username}`
        ]) as Array<Record<string, string>>;

        let disconnected = 0;
        for (const session of sessions || []) {
          if (session['.id']) {
            await conn.write('/ppp/active/remove', [
              `=.id=${session['.id']}`
            ]);
            disconnected++;
          }
        }

        conn.close();
        return { success: true, disconnected };
      } catch (error: unknown) {
        conn.close();
        throw error;
      }
    } catch (error: unknown) {
      console.error('[PPPSecretService] disconnectSession error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, disconnected: 0, error: errorMessage };
    }
  }

  /**
   * Hapus PPP Secret dari MikroTik
   */
  async deleteSecret(
    routerId: string,
    username: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const router = await this.prisma.mikroTikRouter.findUnique({
        where: { id: routerId }
      });

      if (!router) {
        return { success: false, error: 'Router tidak ditemukan' };
      }

      const conn = await this.connectToRouter({
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: router.apiUsernameGenerated || router.apiUsername,
        apiPassword: router.apiPasswordGenerated || router.apiPassword,
      });

      try {
        // 1. Hapus secret DULU (agar tidak bisa auto-reconnect)
        const secrets = await conn.write('/ppp/secret/print', [
          `?name=${username}`
        ]) as Array<Record<string, string>>;

        for (const secret of secrets || []) {
          if (secret['.id']) {
            await conn.write('/ppp/secret/remove', [`=.id=${secret['.id']}`]);
          }
        }

        // 2. Baru disconnect session (kick user)
        const activeSessions = await conn.write('/ppp/active/print', [
          `?name=${username}`
        ]) as Array<Record<string, string>>;

        for (const session of activeSessions || []) {
          if (session['.id']) {
            await conn.write('/ppp/active/remove', [`=.id=${session['.id']}`]);
          }
        }

        conn.close();
        return { success: true };
      } catch (error: unknown) {
        conn.close();
        throw error;
      }
    } catch (error: unknown) {
      console.error('[PPPSecretService] deleteSecret error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Isolasi pelanggan: Ubah profile ke "expired users" + disconnect
   */
  async isolateCustomer(
    pelangganId: string
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [];

    try {
      const data = await this.getRouterFromPelanggan(pelangganId);
      if (!data) {
        return { 
          success: false, 
          logs, 
          error: 'Pelanggan atau router tidak ditemukan' 
        };
      }

      const { router, routerId, pelanggan } = data;
      logs.push(`Connecting to router ${router.ipAddress}`);

      // 1. Ubah profile ke expired users
      const profileResult = await this.setSecretProfile(
        routerId, 
        pelanggan.username, 
        EXPIRED_PROFILE
      );
      
      if (!profileResult.success) {
        // Jika error karena secret tidak ditemukan (misal user RADIUS),
        // kita tetap lanjut disconnect session agar user ter-kick.
        if (profileResult.error === 'PPP Secret tidak ditemukan') {
           logs.push('Warning: PPP Secret tidak ditemukan, melanjutkan disconnect session...');
        } else {
           return {
             success: false,
             logs,
             ...(profileResult.error ? { error: profileResult.error } : {})
           };
        }
      } else {
        logs.push(`Profile diubah ke "${EXPIRED_PROFILE}"`);
      }

      // 2. Disconnect session
      const disconnectResult = await this.disconnectSession(
        routerId, 
        pelanggan.username
      );
      logs.push(`Disconnected ${disconnectResult.disconnected} session(s)`);

      return { success: true, logs };
    } catch (error: unknown) {
      console.error('[PPPSecretService] isolateCustomer error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, logs, error: errorMessage };
    }
  }

  /**
   * Un-isolasi pelanggan: Kembalikan profile normal + disconnect
   */
  async unIsolateCustomer(
    pelangganId: string
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [];

    try {
      const data = await this.getRouterFromPelanggan(pelangganId);
      if (!data) {
        return { 
          success: false, 
          logs, 
          error: 'Pelanggan atau router tidak ditemukan' 
        };
      }

      const { router, routerId, pelanggan, profileName } = data;
      logs.push(`Connecting to router ${router.ipAddress}`);

      // 1. Kembalikan profile normal
      const profileResult = await this.setSecretProfile(
        routerId, 
        pelanggan.username, 
        profileName
      );
      
      if (!profileResult.success) {
        return { success: false, logs, error: profileResult.error };
      }
      logs.push(`Profile dikembalikan ke "${profileName}"`);

      // 2. Disconnect session agar reload dengan profile baru
      const disconnectResult = await this.disconnectSession(
        routerId, 
        pelanggan.username
      );
      logs.push(`Disconnected ${disconnectResult.disconnected} session(s)`);

      return { success: true, logs };
    } catch (error: unknown) {
      console.error('[PPPSecretService] unIsolateCustomer error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, logs, error: errorMessage };
    }
  }

  /**
   * Dismantle pelanggan: Hapus secret sepenuhnya
   */
  async dismantleCustomer(
    pelangganId: string
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [];

    try {
      const data = await this.getRouterFromPelanggan(pelangganId);
      if (!data) {
        return { 
          success: false, 
          logs, 
          error: 'Pelanggan atau router tidak ditemukan' 
        };
      }

      const { routerId, pelanggan } = data;
      logs.push(`Menghapus secret untuk ${pelanggan.username}`);

      const result = await this.deleteSecret(routerId, pelanggan.username);
      
      if (!result.success) {
        return { success: false, logs, error: result.error };
      }
      logs.push('PPP Secret berhasil dihapus');

      return { success: true, logs };
    } catch (error: unknown) {
      console.error('[PPPSecretService] dismantleCustomer error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, logs, error: errorMessage };
    }
  }

  /**
   * Sync PPP Secret saat pelanggan didaftarkan
   */
  async syncNewCustomer(
    pelangganId: string
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [];

    try {
      const data = await this.getRouterFromPelanggan(pelangganId);
      if (!data) {
        return { 
          success: false, 
          logs, 
          error: 'Pelanggan atau router tidak ditemukan' 
        };
      }

      const { routerId, pelanggan, profileName } = data;
      logs.push(`Creating PPP Secret untuk ${pelanggan.username}`);

      const result = await this.createSecret(routerId, {
        name: pelanggan.username,
        password: pelanggan.password,
        profile: profileName,
        service: 'pppoe',
        comment: `customer: ${pelanggan.nama}`,
      });

      if (!result.success) {
        return { success: false, logs, error: result.error };
      }
      logs.push('PPP Secret berhasil dibuat');

      return { success: true, logs };
    } catch (error: unknown) {
      console.error('[PPPSecretService] syncNewCustomer error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, logs, error: errorMessage };
    }
  }
}

export default MikroTikPPPSecretService;
