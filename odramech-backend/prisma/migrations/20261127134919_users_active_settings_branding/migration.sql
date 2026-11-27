-- CreateEnum
CREATE TYPE "odramech"."QuoteTemplate" AS ENUM ('ODRAMECH', 'PREMIUM', 'CUSTOM');

-- AlterTable
ALTER TABLE "odramech"."cad_user_corporation" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "odramech"."establishment_settings" (
    "id_establishment" INTEGER NOT NULL,
    "quote_template" "odramech"."QuoteTemplate" NOT NULL DEFAULT 'ODRAMECH',
    "quote_header_html" TEXT,
    "quote_body_html" TEXT,
    "quote_footer_html" TEXT,
    "quote_validity_days" INTEGER NOT NULL DEFAULT 15,
    "mark_quote_sent_on_print" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "establishment_settings_pkey" PRIMARY KEY ("id_establishment")
);

-- CreateTable
CREATE TABLE "odramech"."enterprise_branding" (
    "id_enterprise" INTEGER NOT NULL,
    "public_key" TEXT NOT NULL,
    "display_name" TEXT,
    "logo_url" TEXT,
    "accent_color" TEXT,
    "login_image_url" TEXT,
    "login_headline" TEXT,
    "login_subtitle" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_branding_pkey" PRIMARY KEY ("id_enterprise")
);

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_branding_public_key_key" ON "odramech"."enterprise_branding"("public_key");

-- AddForeignKey
ALTER TABLE "odramech"."establishment_settings" ADD CONSTRAINT "establishment_settings_id_establishment_fkey" FOREIGN KEY ("id_establishment") REFERENCES "odramech"."cad_establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."enterprise_branding" ADD CONSTRAINT "enterprise_branding_id_enterprise_fkey" FOREIGN KEY ("id_enterprise") REFERENCES "odramech"."cad_enterprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
