-- CreateEnum
CREATE TYPE "odramech"."QuoteStatus" AS ENUM ('RASCUNHO', 'ENVIADO', 'APROVADO', 'RECUSADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "odramech"."ItemKind" AS ENUM ('PECA', 'SERVICO');

-- CreateEnum
CREATE TYPE "odramech"."PaymentMethod" AS ENUM ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'BOLETO');

-- CreateEnum
CREATE TYPE "odramech"."ArchiveType" AS ENUM ('IMAGEM', 'DOCUMENTO', 'VIDEO');

-- AlterTable (seguro para linhas existentes: converte o tipo em vez de recriar a coluna)
ALTER TABLE "odramech"."archive_appointment" DROP COLUMN "id_archive",
ADD COLUMN     "original_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "size_bytes" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN   "archive_type" TYPE "odramech"."ArchiveType" USING (
  CASE "archive_type" WHEN 2 THEN 'DOCUMENTO' WHEN 3 THEN 'VIDEO' ELSE 'IMAGEM' END
)::"odramech"."ArchiveType";

ALTER TABLE "odramech"."archive_appointment" ALTER COLUMN "original_name" DROP DEFAULT,
ALTER COLUMN   "size_bytes" DROP DEFAULT;

-- AlterTable
ALTER TABLE "odramech"."establishment_os_counter" ADD COLUMN     "last_number_quote" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "odramech"."quotes" (
    "id" SERIAL NOT NULL,
    "number_quote" INTEGER NOT NULL,
    "status" "odramech"."QuoteStatus" NOT NULL DEFAULT 'RASCUNHO',
    "id_establishment" INTEGER NOT NULL,
    "id_client" INTEGER NOT NULL,
    "id_vehicle" INTEGER NOT NULL,
    "id_user_creation" INTEGER NOT NULL,
    "id_work_order" INTEGER,
    "valid_until" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."service_items" (
    "id" SERIAL NOT NULL,
    "kind" "odramech"."ItemKind" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "id_quote" INTEGER,
    "id_work_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."payments" (
    "id" SERIAL NOT NULL,
    "id_work_order" INTEGER NOT NULL,
    "method" "odramech"."PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_user" INTEGER NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."reviews" (
    "id" SERIAL NOT NULL,
    "id_work_order" INTEGER NOT NULL,
    "id_client" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."user_notes" (
    "id_user" INTEGER NOT NULL,
    "id_establishment" INTEGER NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notes_pkey" PRIMARY KEY ("id_user","id_establishment")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotes_id_work_order_key" ON "odramech"."quotes"("id_work_order");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_id_establishment_number_quote_key" ON "odramech"."quotes"("id_establishment", "number_quote");

-- CreateIndex
CREATE INDEX "service_items_id_quote_idx" ON "odramech"."service_items"("id_quote");

-- CreateIndex
CREATE INDEX "service_items_id_work_order_idx" ON "odramech"."service_items"("id_work_order");

-- CreateIndex
CREATE INDEX "payments_id_work_order_idx" ON "odramech"."payments"("id_work_order");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_id_work_order_key" ON "odramech"."reviews"("id_work_order");

-- AddForeignKey
ALTER TABLE "odramech"."quotes" ADD CONSTRAINT "quotes_id_establishment_fkey" FOREIGN KEY ("id_establishment") REFERENCES "odramech"."cad_establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."quotes" ADD CONSTRAINT "quotes_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "odramech"."cad_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."quotes" ADD CONSTRAINT "quotes_id_vehicle_fkey" FOREIGN KEY ("id_vehicle") REFERENCES "odramech"."cad_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."quotes" ADD CONSTRAINT "quotes_id_user_creation_fkey" FOREIGN KEY ("id_user_creation") REFERENCES "odramech"."cad_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."quotes" ADD CONSTRAINT "quotes_id_work_order_fkey" FOREIGN KEY ("id_work_order") REFERENCES "odramech"."work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."service_items" ADD CONSTRAINT "service_items_id_quote_fkey" FOREIGN KEY ("id_quote") REFERENCES "odramech"."quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."service_items" ADD CONSTRAINT "service_items_id_work_order_fkey" FOREIGN KEY ("id_work_order") REFERENCES "odramech"."work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."payments" ADD CONSTRAINT "payments_id_work_order_fkey" FOREIGN KEY ("id_work_order") REFERENCES "odramech"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."payments" ADD CONSTRAINT "payments_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "odramech"."cad_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."reviews" ADD CONSTRAINT "reviews_id_work_order_fkey" FOREIGN KEY ("id_work_order") REFERENCES "odramech"."work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."reviews" ADD CONSTRAINT "reviews_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "odramech"."cad_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."user_notes" ADD CONSTRAINT "user_notes_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "odramech"."cad_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."user_notes" ADD CONSTRAINT "user_notes_id_establishment_fkey" FOREIGN KEY ("id_establishment") REFERENCES "odramech"."cad_establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

