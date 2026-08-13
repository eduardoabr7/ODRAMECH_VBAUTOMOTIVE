/*
  Warnings:

  - Added the required column `id_work_order` to the `appointments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "odramech"."appointments" ADD COLUMN     "id_work_order" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "odramech"."appointments" ADD CONSTRAINT "appointments_id_work_order_fkey" FOREIGN KEY ("id_work_order") REFERENCES "odramech"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
