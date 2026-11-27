-- CreateEnum
CREATE TYPE "odramech"."QuoteEmailKind" AS ENUM ('ENVIO', 'ATUALIZACAO');

-- CreateEnum
CREATE TYPE "odramech"."QuoteEmailTrigger" AS ENUM ('AUTOMATICO', 'MANUAL');

-- CreateEnum
CREATE TYPE "odramech"."QuoteEmailStatus" AS ENUM ('ENVIADO', 'SIMULADO', 'FALHOU');

-- AlterTable
ALTER TABLE "odramech"."establishment_settings" ADD COLUMN     "auto_email_quote" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "odramech"."quotes" ADD COLUMN     "client_responded_at" TIMESTAMP(3),
ADD COLUMN     "email_pending_at" TIMESTAMP(3),
ADD COLUMN     "email_sent_at" TIMESTAMP(3),
ADD COLUMN     "email_sent_version" INTEGER,
ADD COLUMN     "public_token" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "odramech"."quote_emails" (
    "id" SERIAL NOT NULL,
    "id_quote" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "odramech"."QuoteEmailKind" NOT NULL,
    "trigger" "odramech"."QuoteEmailTrigger" NOT NULL,
    "status" "odramech"."QuoteEmailStatus" NOT NULL,
    "to_email" TEXT NOT NULL,
    "error" TEXT,
    "id_user" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_emails_id_quote_created_at_idx" ON "odramech"."quote_emails"("id_quote", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_public_token_key" ON "odramech"."quotes"("public_token");

-- CreateIndex
CREATE INDEX "quotes_email_pending_at_idx" ON "odramech"."quotes"("email_pending_at");

-- AddForeignKey
ALTER TABLE "odramech"."quote_emails" ADD CONSTRAINT "quote_emails_id_quote_fkey" FOREIGN KEY ("id_quote") REFERENCES "odramech"."quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

