import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getUserRepository } from '@/lib/repositories'
import { userCreateSchema } from '@/lib/validations/user'
import { hash } from 'bcryptjs'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userRepository = getUserRepository()
  const users = await userRepository.findAll()
  return NextResponse.json({ users })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = userCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { email, name, password, role } = parsed.data
  const passwordHash = await hash(password, 10)
  try {
    const userRepository = getUserRepository()
    const user = await userRepository.create({ email, name: name || null, passwordHash, role })
    return NextResponse.json({ id: user.id })
  } catch (e: any) {
    return NextResponse.json({ error: 'Email sudah terpakai' }, { status: 409 })
  }
}


