import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { handle } from 'hono/vercel'
import { AppError } from '@/lib/errors'

const app = new Hono().basePath('/api')

app.onError((err, c) => {
  console.error(err)
  if (err instanceof AppError) {
    return c.json(
      { error: err.message, code: err.code, ...((err.details as Record<string, unknown>) ?? {}) },
      err.statusCode as ContentfulStatusCode
    )
  }
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const PATCH = handle(app)

export type AppType = typeof app
