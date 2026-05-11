import NextAuth from "next-auth";
import { createAuthConfig } from "@/lib/auth";

async function handler(request: Request, context: unknown) {
  const authOptions = await createAuthConfig();
  return NextAuth(authOptions)(request, context as never);
}

export { handler as GET, handler as POST };
