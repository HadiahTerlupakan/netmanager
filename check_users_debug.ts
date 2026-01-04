
import { prisma } from './lib/prisma'

async function main() {
  try {
    const count = await prisma.user.count()
    console.log(`Total Users: ${count}`)
    
    if (count > 0) {
        const users = await prisma.user.findMany({ 
            take: 5,
            select: { id: true, name: true, email: true }
        })
        console.log('Sample Users:', JSON.stringify(users, null, 2))
    }
  } catch (e) {
    console.error('Error querying users:', e)
  }
}

main()
