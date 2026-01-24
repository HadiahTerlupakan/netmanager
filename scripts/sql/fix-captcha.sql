-- Enable Cloudflare Turnstile Settings
-- Uses gen_random_uuid() for ID generation since Prisma CUID is client-side

INSERT INTO "Settings" ("id", "key", "value", "description", "updatedAt")
VALUES 
    (gen_random_uuid()::text, 'captcha_enabled', 'true', 'Enable/Disable Cloudflare Turnstile', NOW()),
    (gen_random_uuid()::text, 'captcha_site_key', '0x4AAAAAACINyWVLDW5zHjOQ', 'Cloudflare Turnstile Site Key', NOW()),
    (gen_random_uuid()::text, 'captcha_secret_key', '0x4AAAAAACINyXRl8RUfcF2pHkqU9TZk0bc', 'Cloudflare Turnstile Secret Key', NOW())
ON CONFLICT ("key") 
DO UPDATE SET 
    "value" = EXCLUDED."value",
    "updatedAt" = NOW();
