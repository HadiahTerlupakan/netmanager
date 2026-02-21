import { defineConfig, env } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
  schema: 'prisma/schema.radius.prisma',
  migrations: {
    path: 'prisma/radius_migrations',
  },
  datasource: {
    url: env('RADIUS_DATABASE_URL'),
  },
})
