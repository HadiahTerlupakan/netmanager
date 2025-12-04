import NextAuth from "next-auth"
import { createAuthConfig } from "@/lib/auth"

const handler = async (req: any, res: any) => {
    // Load configuration dynamically
    const config = await createAuthConfig()

    // Initialize NextAuth
    // In NextAuth v4, NextAuth() returns the handler function directly
    return NextAuth(req, res, config)
}

export { handler as GET, handler as POST }
