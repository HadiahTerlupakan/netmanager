import { prisma } from './lib/prisma'
import { compare } from 'bcryptjs'

async function check() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
    include: { role: true }
  })
  if (user) {
    const ok = await compare('admin123', user.passwordHash || '')
    console.log('User found:', { 
      email: user.email, 
      role: user.role?.name, 
      isActive: user.isActive,
      passwordValid: ok 
    })
  } else {
    console.log('User NOT found')
  }
}
check()
