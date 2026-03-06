import { defineConfig, env } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
    schema: 'prisma/mitra.prisma',
    migrations: {
        path: 'prisma/mitra_migrations',
    },
    datasource: {
        url: env('DATABASE_URL_MITRA'),
    },
})
