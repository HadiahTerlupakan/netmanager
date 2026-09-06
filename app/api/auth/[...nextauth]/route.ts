import NextAuth from "next-auth";
import { createAuthConfig } from "@/lib/auth";
import { withHostOnlyCookieCleanup } from "@/lib/auth/host-only-cookies";

async function handler(request: Request, context: unknown) {
  const authOptions = await createAuthConfig();
  const response = await NextAuth(authOptions)(request, context as never);

  return withHostOnlyCookieCleanup(response as Response);
}

export { handler as GET, handler as POST };
