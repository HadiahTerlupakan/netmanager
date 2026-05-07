import type { NextAuthOptions } from "next-auth";
import _NextAuth from "next-auth";
import _CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prismaAuth } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  checkStrictLoginRateLimit,
  isLoginRateLimitEnabled,
  LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE,
} from "@/lib/security/login-rate-limit";
import { cookies } from "./cookies";
import { jwtCallback, sessionCallback } from "./callbacks";

const NextAuth =
  ((_NextAuth as { default?: unknown }).default as typeof _NextAuth) ||
  _NextAuth;

const CredentialsProvider =
  ((_CredentialsProvider as { default?: unknown })
    .default as typeof _CredentialsProvider) || _CredentialsProvider;

async function validateDatabaseConnection(): Promise<boolean> {
  try {
    logger.info("[AUTH] Validating database connection...");
    logger.info("[AUTH] ENV check:", {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
    });
    await prismaAuth.$queryRaw`SELECT 1`;
    logger.info("[AUTH] Database connection: OK");
    return true;
  } catch (error) {
    logger.error("[AUTH] Database connection failed:", error);
    return false;
  }
}

export const authConfig: NextAuthOptions = {
  adapter: PrismaAdapter(prismaAuth as never) as NextAuthOptions["adapter"],
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "",
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
    maxAge: parseInt(process.env.SESSION_MAX_AGE || "604800"),
    updateAge: parseInt(process.env.SESSION_UPDATE_AGE || "1800"),
  },
  cookies,
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        identifier: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        portal: { label: "Portal", type: "text" },
      },
      async authorize(creds) {
        try {
          const identifier = creds?.identifier;
          const password = creds?.password;

          logger.info(
            "[AUTH] Login attempt with identifier:",
            identifier?.substring(0, 3) + "***",
          );

          if (!identifier || !password) {
            logger.info("[AUTH] Missing identifier or password");
            return null;
          }

          const dbConnected = await validateDatabaseConnection();
          if (!dbConnected) {
            logger.error(
              "[AUTH] Database connection failed during login attempt",
            );
            throw new Error(
              "Koneksi database gagal. Silakan coba lagi beberapa saat.",
            );
          }

          if (isLoginRateLimitEnabled()) {
            const rateLimitResult = await checkStrictLoginRateLimit(
              `login:${identifier}`,
              500,
              300,
            );

            if (rateLimitResult === "unavailable") {
              throw new Error(LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE);
            }

            if (rateLimitResult === "rate_limited") {
              logger.info("[AUTH] Rate limit exceeded for:", identifier);
              throw new Error("Terlalu banyak percobaan. Coba lagi nanti.");
            }
          }

          let user = null;

          logger.info("[AUTH] Attempting email login");
          user = await prismaAuth.user.findUnique({
            where: { email: identifier },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              phone: true,
              departmentId: true,
              siteId: true,
              isActive: true,
              createdAt: true,
              passwordHash: true,
            },
          });
          logger.info("[AUTH] User found by email:", !!user);

          if (!user?.passwordHash) {
            user = null;
          }

          if (!user) {
            logger.info("[AUTH] No user found for identifier:", identifier);
            return null;
          }

          logger.info("[AUTH] Verifying password...");
          const ok = await compare(password, user.passwordHash ?? "");
          logger.info("[AUTH] Password valid:", ok);

          if (!ok) {
            logger.info("[AUTH] Password mismatch");
            return null;
          }

          const portal = creds?.portal;
          if (portal) {
            logger.info(`[AUTH] Checking access for portal: ${portal}`);
            const userWithRole = await prismaAuth.user.findUnique({
              where: { id: user.id },
              include: { role: true },
            });

            const role = userWithRole?.role;

            if (role?.name === "SUPER_ADMIN" || role?.name === "Super Admin") {
              logger.info("[AUTH] SUPER_ADMIN access granted");
            } else {
              if (portal === "admin" && !role?.accessAdminPanel) {
                logger.warn(
                  "[AUTH] Access denied: User tried to access ADMIN portal without permission",
                );
                throw new Error(
                  "Akses ditolak. Anda tidak memiliki izin untuk mengakses Portal Admin.",
                );
              }

              if (portal === "employee" && !role?.accessEmployeePanel) {
                logger.warn(
                  "[AUTH] Access denied: User tried to access EMPLOYEE portal without permission",
                );
                throw new Error(
                  "Akses ditolak. Anda tidak memiliki izin untuk mengakses Portal Karyawan.",
                );
              }
            }
          }

          logger.info("[AUTH] Login successful for:", user.email);

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
          } as unknown as import("next-auth").User;
        } catch (error) {
          logger.error("[AUTH] Error in authorize:", error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async signIn() {
      return true;
    },
    jwt: jwtCallback,
    session: sessionCallback,
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      const { logger } = await import("@/lib/logger");

      let roleName = "Unknown";
      let portal = "Unknown";
      try {
        const dbUser = await prismaAuth.user.findUnique({
          where: { id: user.id },
          include: { role: true },
        });
        roleName = dbUser?.role?.name || "No Role";
        portal = dbUser?.role?.accessAdminPanel
          ? "Admin Portal"
          : dbUser?.role?.accessEmployeePanel
            ? "Employee Portal"
            : "Unknown";

        await prismaAuth.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      } catch (e) {
        logger.error("[AUTH] Failed to fetch user role for logging:", e);
      }

      await logger.logAuth({
        action: "LOGIN",
        userId: user.id,
        details: {
          email: user.email,
          name: user.name || "N/A",
          role: roleName,
          portal: portal,
          provider: account?.provider || "credentials",
          isNewUser: isNewUser || false,
          loginTime: new Date().toISOString(),
        },
      });
    },
  },
};

export async function createAuthConfig(): Promise<NextAuthOptions> {
  return authConfig;
}

export const authOptions = authConfig;

export const handler = NextAuth(authConfig);
