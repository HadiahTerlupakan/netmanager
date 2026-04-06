WITH tenant_source AS (
    SELECT "username", "tenantId"
    FROM "radcheck"
    WHERE "tenantId" IS NOT NULL AND "tenantId" <> ''

    UNION

    SELECT "username", "tenantId"
    FROM "radreply"
    WHERE "tenantId" IS NOT NULL AND "tenantId" <> ''

    UNION

    SELECT "username", "tenantId"
    FROM "radusergroup"
    WHERE "tenantId" IS NOT NULL AND "tenantId" <> ''
),
tenant_resolved AS (
    SELECT
        "username",
        MIN("tenantId") AS "tenantId"
    FROM tenant_source
    GROUP BY "username"
    HAVING COUNT(DISTINCT "tenantId") = 1
)
UPDATE "radacct" ra
SET "tenantId" = tr."tenantId"
FROM tenant_resolved tr
WHERE ra."username" = tr."username"
  AND (ra."tenantId" IS NULL OR ra."tenantId" = '');

CREATE OR REPLACE FUNCTION public.set_radacct_tenantid_from_username()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    resolved_tenant_id TEXT;
    tenant_count INTEGER;
BEGIN
    IF NEW."tenantId" IS NOT NULL AND NEW."tenantId" <> '' THEN
        RETURN NEW;
    END IF;

    WITH tenant_source AS (
        SELECT "tenantId"
        FROM "radcheck"
        WHERE "username" = NEW."username"
          AND "tenantId" IS NOT NULL
          AND "tenantId" <> ''

        UNION

        SELECT "tenantId"
        FROM "radreply"
        WHERE "username" = NEW."username"
          AND "tenantId" IS NOT NULL
          AND "tenantId" <> ''

        UNION

        SELECT "tenantId"
        FROM "radusergroup"
        WHERE "username" = NEW."username"
          AND "tenantId" IS NOT NULL
          AND "tenantId" <> ''
    )
    SELECT COUNT(*), MIN("tenantId")
    INTO tenant_count, resolved_tenant_id
    FROM tenant_source;

    IF tenant_count = 1 THEN
        NEW."tenantId" := resolved_tenant_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_radacct_set_tenantid ON "radacct";

CREATE TRIGGER trg_radacct_set_tenantid
BEFORE INSERT OR UPDATE OF "username", "tenantId"
ON "radacct"
FOR EACH ROW
EXECUTE FUNCTION public.set_radacct_tenantid_from_username();
