import { defineConfig, env } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
    schema: 'prisma/billing.prisma',
    migrations: {
        path: 'prisma/billing_migrations',
    },
    datasource: {
        url: env('DATABASE_URL_BILLING'),
    },
})
