import { defineConfig, env } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
    schema: 'prisma/billing.prisma',
    datasource: {
        url: env('DATABASE_URL_BILLING'),
    },
})
