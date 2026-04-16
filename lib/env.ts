import * as z from "zod";

const baseEnvSchema = z.object({
  // Database
  DATABASE_URL: z.url(),

  // Auth
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.url().optional(),

  // Redis
  REDIS_URL: z.string().optional(),

  // R2/S3
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Cron Security
  CRON_SECRET: z.string().min(32).optional(),

  // Node Environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof baseEnvSchema>;

let parsedEnv: Env | null = null;

function validateRedisUrl(env: Env): void {
  if (env.NODE_ENV === "production" && !env.REDIS_URL) {
    throw new Error("REDIS_URL is required in production environment");
  }
}

export function getEnv(): Env {
  if (!parsedEnv) {
    const env = baseEnvSchema.parse(process.env);
    validateRedisUrl(env);
    parsedEnv = env;
  }

  return parsedEnv;
}
