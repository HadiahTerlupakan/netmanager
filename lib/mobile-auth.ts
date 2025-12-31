import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-secret-for-dev'
)

export async function signMobileToken(payload: any) {
    // Set sub (subject) to user id if not already set
    const jwtPayload = {
        ...payload,
        sub: payload.sub || payload.id
    }
    return await new SignJWT(jwtPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret)
}

export async function verifyMobileToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, secret)
        // Support both 'sub' and 'id' for backwards compatibility
        const userId = payload.sub || (payload as any).id
        return { ...payload, sub: userId, userId } as any
    } catch (error) {
        return null
    }
}
