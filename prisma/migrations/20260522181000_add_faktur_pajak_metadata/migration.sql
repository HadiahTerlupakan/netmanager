-- Faktur Pajak metadata for Expense (PPN Masukan claim ke DJP)
ALTER TABLE "Expense"
  ADD COLUMN "fakturPajakNo"   TEXT,
  ADD COLUMN "fakturPajakDate" TIMESTAMP(3),
  ADD COLUMN "vendorNpwp"      TEXT;

-- Faktur Pajak metadata for PurchaseOrder
ALTER TABLE "purchase_orders"
  ADD COLUMN "fakturPajakNo"   TEXT,
  ADD COLUMN "fakturPajakDate" TIMESTAMP(3),
  ADD COLUMN "vendorNpwp"      TEXT;

-- Faktur Pajak metadata pada TaxTransaction (denormalized utk Coretax export)
ALTER TABLE "tax_transactions"
  ADD COLUMN "fakturPajakNo"   TEXT,
  ADD COLUMN "fakturPajakDate" TIMESTAMP(3),
  ADD COLUMN "counterpartNpwp" TEXT;

CREATE INDEX "Expense_fakturPajakNo_idx" ON "Expense" ("fakturPajakNo");
CREATE INDEX "purchase_orders_fakturPajakNo_idx" ON "purchase_orders" ("fakturPajakNo");
CREATE INDEX "tax_transactions_fakturPajakNo_idx" ON "tax_transactions" ("fakturPajakNo");
