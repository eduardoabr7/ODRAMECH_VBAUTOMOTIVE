-- CreateEnum
CREATE TYPE "odramech"."Role" AS ENUM ('ADMIN', 'USER', 'WORKER');

-- CreateTable
CREATE TABLE "odramech"."cad_user" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "addressId" INTEGER,

    CONSTRAINT "cad_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."cad_enterprise" (
    "id" SERIAL NOT NULL,
    "logoUrl" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "addressId" INTEGER NOT NULL,

    CONSTRAINT "cad_enterprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."cad_establishment" (
    "id" SERIAL NOT NULL,
    "logoUrl" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "addressId" INTEGER NOT NULL,

    CONSTRAINT "cad_establishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."cad_address" (
    "id" SERIAL NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,

    CONSTRAINT "cad_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."cad_enterprise_establishment" (
    "idEnterprise" INTEGER NOT NULL,
    "idEstablishment" INTEGER NOT NULL,

    CONSTRAINT "cad_enterprise_establishment_pkey" PRIMARY KEY ("idEnterprise","idEstablishment")
);

-- CreateTable
CREATE TABLE "odramech"."cad_user_corporation" (
    "idUser" INTEGER NOT NULL,
    "idEnterprise" INTEGER NOT NULL,
    "idEstablishment" INTEGER NOT NULL,
    "role" "odramech"."Role" NOT NULL,

    CONSTRAINT "cad_user_corporation_pkey" PRIMARY KEY ("idUser","idEnterprise","idEstablishment")
);

-- CreateIndex
CREATE UNIQUE INDEX "cad_user_email_key" ON "odramech"."cad_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cad_user_username_key" ON "odramech"."cad_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "cad_user_addressId_key" ON "odramech"."cad_user"("addressId");

-- CreateIndex
CREATE UNIQUE INDEX "cad_enterprise_cnpj_key" ON "odramech"."cad_enterprise"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "cad_enterprise_addressId_key" ON "odramech"."cad_enterprise"("addressId");

-- CreateIndex
CREATE UNIQUE INDEX "cad_establishment_cnpj_key" ON "odramech"."cad_establishment"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "cad_establishment_addressId_key" ON "odramech"."cad_establishment"("addressId");

-- AddForeignKey
ALTER TABLE "odramech"."cad_user" ADD CONSTRAINT "cad_user_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "odramech"."cad_address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."cad_enterprise" ADD CONSTRAINT "cad_enterprise_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "odramech"."cad_address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."cad_establishment" ADD CONSTRAINT "cad_establishment_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "odramech"."cad_address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."cad_enterprise_establishment" ADD CONSTRAINT "cad_enterprise_establishment_idEnterprise_fkey" FOREIGN KEY ("idEnterprise") REFERENCES "odramech"."cad_enterprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."cad_enterprise_establishment" ADD CONSTRAINT "cad_enterprise_establishment_idEstablishment_fkey" FOREIGN KEY ("idEstablishment") REFERENCES "odramech"."cad_establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."cad_user_corporation" ADD CONSTRAINT "cad_user_corporation_idUser_fkey" FOREIGN KEY ("idUser") REFERENCES "odramech"."cad_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."cad_user_corporation" ADD CONSTRAINT "cad_user_corporation_idEnterprise_fkey" FOREIGN KEY ("idEnterprise") REFERENCES "odramech"."cad_enterprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."cad_user_corporation" ADD CONSTRAINT "cad_user_corporation_idEstablishment_fkey" FOREIGN KEY ("idEstablishment") REFERENCES "odramech"."cad_establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
