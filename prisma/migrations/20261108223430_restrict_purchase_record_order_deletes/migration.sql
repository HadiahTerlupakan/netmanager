-- DropForeignKey
ALTER TABLE "purchase_record_items" DROP CONSTRAINT "purchase_record_items_purchaseOrderItemId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_records" DROP CONSTRAINT "purchase_records_purchaseOrderId_fkey";

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_record_items" ADD CONSTRAINT "purchase_record_items_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
