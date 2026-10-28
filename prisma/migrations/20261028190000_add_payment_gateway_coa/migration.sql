-- Akun untuk penerimaan lewat payment gateway, ditambahkan ke setiap tenant
-- yang COA default-nya sudah dibuat (tenant baru mendapatkannya dari
-- DEFAULT_COA). Dulu semua pembayaran gateway dicatat ke "Bank" walau
-- dananya masih di gateway, dan biaya gateway tidak dibukukan.
INSERT INTO "chart_of_accounts"
  ("id", "tenantId", "code", "name", "type", "subtype", "normalSide",
   "cashFlowCategory", "parentId", "isPostable", "isSystem", "isActive",
   "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, parent."tenantId", '1-140', 'Saldo Payment Gateway',
  'ASSET'::"COAType", 'CURRENT_ASSET'::"COASubtype", 'DEBIT'::"DebitCredit",
  NULL, parent."id", true, true, true, now(), now()
FROM "chart_of_accounts" parent
WHERE parent."code" = '1-100'
ON CONFLICT ("tenantId", "code") DO NOTHING;

INSERT INTO "chart_of_accounts"
  ("id", "tenantId", "code", "name", "type", "subtype", "normalSide",
   "cashFlowCategory", "parentId", "isPostable", "isSystem", "isActive",
   "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, parent."tenantId", '5-610', 'Beban Biaya Payment Gateway',
  'EXPENSE'::"COAType", 'OPEX'::"COASubtype", 'DEBIT'::"DebitCredit",
  'OPERATING'::"CashFlowCategory", parent."id", true, true, true, now(), now()
FROM "chart_of_accounts" parent
WHERE parent."code" = '5-000'
ON CONFLICT ("tenantId", "code") DO NOTHING;
