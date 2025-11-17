/*
  Warnings:

  - The primary key for the `cad_enterprise_establishment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id_enterprise` on the `cad_enterprise_establishment` table. All the data in the column will be lost.
  - You are about to drop the column `id_establishment` on the `cad_enterprise_establishment` table. All the data in the column will be lost.
  - The primary key for the `cad_user_corporation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id_enterprise` on the `cad_user_corporation` table. All the data in the column will be lost.
  - You are about to drop the column `id_establishment` on the `cad_user_corporation` table. All the data in the column will be lost.
  - You are about to drop the column `id_user` on the `cad_user_corporation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[addressId]` on the table `cad_enterprise` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[addressId]` on the table `cad_establishment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[addressId]` on the table `cad_user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `addressId` to the `cad_enterprise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idEnterprise` to the `cad_enterprise_establishment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idEstablishment` to the `cad_enterprise_establishment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addressId` to the `cad_establishment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idEnterprise` to the `cad_user_corporation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idEstablishment` to the `cad_user_corporation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idUser` to the `cad_user_corporation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "odramech"."cad_enterprise_establishment" DROP CONSTRAINT "cad_enterprise_establishment_id_enterprise_fkey";

-- DropForeignKey
ALTER TABLE "odramech"."cad_enterprise_establishment" DROP CONSTRAINT "cad_enterprise_establishment_id_establishment_fkey";

-- DropForeignKey
ALTER TABLE "odramech"."cad_user_corporation" DROP CONSTRAINT "cad_user_corporation_id_enterprise_fkey";

-- DropForeignKey
ALTER TABLE "odramech"."cad_user_corporation" DROP CONSTRAINT "cad_user_corporation_id_establishment_fkey";

-- DropForeignKey
ALTER TABLE "odramech"."cad_user_corporation" DROP CONSTRAINT "cad_user_corporation_id_user_fkey";

-- AlterTable
ALTER TABLE "odramech"."cad_enterprise" ADD COLUMN     "addressId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "odramech"."cad_enterprise_establishment" DROP CONSTRAINT "cad_enterprise_establishment_pkey",
DROP COLUMN "id_enterprise",
DROP COLUMN "id_establishment",
ADD COLUMN     "idEnterprise" INTEGER NOT NULL,
ADD COLUMN     "idEstablishment" INTEGER NOT NULL,
ADD CONSTRAINT "cad_enterprise_establishment_pkey" PRIMARY KEY ("idEnterprise", "idEstablishment");

-- AlterTable
ALTER TABLE "odramech"."cad_establishment" ADD COLUMN     "addressId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "odramech"."cad_user" ADD COLUMN     "addressId" INTEGER;

-- AlterTable
ALTER TABLE "odramech"."cad_user_corporation" DROP CONSTRAINT "cad_user_corporation_pkey",
DROP COLUMN "id_enterprise",
DROP COLUMN "id_establishment",
DROP COLUMN "id_user",
ADD COLUMN     "idEnterprise" INTEGER NOT NULL,
ADD COLUMN     "idEstablishment" INTEGER NOT NULL,
ADD COLUMN     "idUser" INTEGER NOT NULL,
ADD CONSTRAINT "cad_user_corporation_pkey" PRIMARY KEY ("idUser", "idEnterprise", "idEstablishment");

-- CreateTable
CREATE TABLE "odramech"."cad_address" (
    "id" SERIAL NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,

    CONSTRAINT "cad_address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cad_enterprise_addressId_key" ON "odramech"."cad_enterprise"("addressId");

-- CreateIndex
CREATE UNIQUE INDEX "cad_establishment_addressId_key" ON "odramech"."cad_establishment"("addressId");

-- CreateIndex
CREATE UNIQUE INDEX "cad_user_addressId_key" ON "odramech"."cad_user"("addressId");

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
