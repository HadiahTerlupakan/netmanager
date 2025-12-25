import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { signMobileToken } from '@/lib/mobile-auth'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, password } = body

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
        }

        // 1. Find User
        const user = await prisma.user.findUnique({
            where: { email },
            include: { role: true } // Include role to check permissions
        })

        if (!user || !user.passwordHash) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        // 2. Verify Password
        const isValid = await compare(password, user.passwordHash)
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        // 3. Generate Token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role?.name || 'USER'
        }
        const token = await signMobileToken(tokenPayload)

        // 4. Return Data
        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role?.name
            }
        })

    } catch (error) {
        console.error('Mobile Login Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
