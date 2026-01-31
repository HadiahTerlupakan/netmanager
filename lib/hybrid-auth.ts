import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/mobile-auth";
import type { User } from "next-auth";

export async function getHybridUser(req: Request): Promise<User | null> {
  // 1. Try Mobile Auth first
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (!token) return null;
    const mobileUser = await verifyMobileToken(token);
    
    if (mobileUser) {
        // Normalize to the same shape as NextAuth session user
        // We cast to any because verifyMobileToken returns a payload with fields we need
        // but might not match strict NextAuth User type exactly without some casting
        return {
            id: mobileUser.userId,
            // mobileUser payload might not have name/email/image if not stored in token
            // but we usually need id, role, siteId for API logic
            name: (mobileUser as Record<string, unknown>).name as string || 'Mobile User',
            email: (mobileUser as Record<string, unknown>).email as string,
            image: null,
            role: mobileUser.role,
            siteId: mobileUser.siteId,
        } as User;
    }
  }

  // 2. Fallback to Session Cookie
  const session = await getServerSession(authConfig);
  if (session?.user) {
      return session.user as User;
  }

  return null;
}
