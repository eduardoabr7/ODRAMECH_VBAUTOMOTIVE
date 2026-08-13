/*
  Warnings:

  - A unique constraint covering the columns `[id_establishment,number_os]` on the table `work_orders` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "odramech"."establishment_os_counter" (
    "id_establishment" INTEGER NOT NULL,
    "last_number_os" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "establishment_os_counter_pkey" PRIMARY KEY ("id_establishment")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_id_establishment_number_os_key" ON "odramech"."work_orders"("id_establishment", "number_os");

-- AddForeignKey
ALTER TABLE "odramech"."establishment_os_counter" ADD CONSTRAINT "establishment_os_counter_id_establishment_fkey" FOREIGN KEY ("id_establishment") REFERENCES "odramech"."cad_establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
