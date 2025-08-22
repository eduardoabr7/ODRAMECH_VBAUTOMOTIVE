-- CreateEnum
CREATE TYPE "odramech"."Role" AS ENUM ('ADMIN', 'USER', 'WORKER');

-- CreateTable
CREATE TABLE "odramech"."cad_user" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."cad_enterprise" (
    "id" SERIAL NOT NULL,
    "logoUrl" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "cad_enterprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."cad_establishment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "cad_establishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."cad_enterprise_establishment" (
    "id_enterprise" INTEGER NOT NULL,
    "id_establishment" INTEGER NOT NULL,

    CONSTRAINT "cad_enterprise_establishment_pkey" PRIMARY KEY ("id_enterprise","id_establishment")
);

-- CreateTable
CREATE TABLE "odramech"."cad_user_corporation" (
    "id_user" INTEGER NOT NULL,
    "id_enterprise" INTEGER NOT NULL,
    "id_establishment" INTEGER NOT NULL,
    "role" "odramech"."Role" NOT NULL,

    CONSTRAINT "cad_user_corporation_pkey" PRIMARY KEY ("id_user","id_enterprise","id_establishment")
);

-- CreateIndex
CREATE UNIQUE INDEX "cad_user_email_key" ON "odramech"."cad_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cad_user_username_key" ON "odramech"."cad_user"("username");

-- AddForeignKey
ALTER TABLE "odramech"."cad_enterprise_establishment" ADD CONSTRAINT "cad_enterprise_establishment_id_enterprise_fkey" FOREIGN KEY ("id_enterprise") REFERENCES "odramech"."cad_enterprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."cad_enterprise_establishment" ADD CONSTRAINT "cad_enterprise_establishment_id_establishment_fkey" FOREIGN KEY ("id_establishment") REFERENCES "odramech"."cad_establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."cad_user_corporation" ADD CONSTRAINT "cad_user_corporation_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "odramech"."cad_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."cad_user_corporation" ADD CONSTRAINT "cad_user_corporation_id_enterprise_fkey" FOREIGN KEY ("id_enterprise") REFERENCES "odramech"."cad_enterprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."cad_user_corporation" ADD CONSTRAINT "cad_user_corporation_id_establishment_fkey" FOREIGN KEY ("id_establishment") REFERENCES "odramech"."cad_establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
