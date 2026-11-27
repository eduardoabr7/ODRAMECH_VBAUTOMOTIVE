-- CreateTable
CREATE TABLE "odramech"."enterprise_mail_settings" (
    "id_enterprise" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "password_encrypted" TEXT,
    "from_name" TEXT,
    "from_email" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_mail_settings_pkey" PRIMARY KEY ("id_enterprise")
);

-- AddForeignKey
ALTER TABLE "odramech"."enterprise_mail_settings" ADD CONSTRAINT "enterprise_mail_settings_id_enterprise_fkey" FOREIGN KEY ("id_enterprise") REFERENCES "odramech"."cad_enterprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

