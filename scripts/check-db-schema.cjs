const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkDatabaseSchema() {
  try {
    console.log('Checking database schema...')

    // List all tables in the database
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `

    console.log('\nAll tables in database:')
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`)
    })

    // Check if User table exists and what columns it has
    const userTable = tables.find(t => t.table_name === 'User')
    if (userTable) {
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'User'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `

      console.log('\nUser table columns:')
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`)
      })

      // Check if role column still exists
      const hasRoleColumn = columns.some(col => col.column_name === 'role')
      console.log(`\nRole column exists: ${hasRoleColumn}`)

      // Check some sample users to see their current data
      try {
        const users = await prisma.$queryRaw`SELECT id, email, "name", role FROM "User" LIMIT 5`
        console.log('\nSample users:')
        users.forEach(user => {
          console.log(`  - ${user.email}: role = ${user.role}`)
        })
      } catch (e) {
        console.log('\nSample users (without role):')
        const users = await prisma.$queryRaw`SELECT id, email, "name" FROM "User" LIMIT 5`
        users.forEach(user => {
          console.log(`  - ${user.email}: ${user.name}`)
        })
      }
    } else {
      console.log('\n❌ User table does not exist!')
    }

  } catch (error) {
    console.error('Error checking database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabaseSchema()