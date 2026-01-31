-- CreateEnum
CREATE TYPE "odramech"."Role" AS ENUM ('ADMIN', 'USER', 'WORKER');

-- CreateEnum
CREATE TYPE "odramech"."OrderStatus" AS ENUM ('PENDENTE', 'EM_ATENDIMENTO', 'AGUARDANDO_PECAS', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "odramech"."TypeAppointment" AS ENUM ('PUBLICO', 'INTERNO');

-- CreateTable
CREATE TABLE "odramech"."cad_user" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
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

-- CreateTable
CREATE TABLE "odramech"."work_orders" (
    "id" SERIAL NOT NULL,
    "status" "odramech"."OrderStatus" NOT NULL,
    "date_time_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_time_end" TIMESTAMPTZ(6),
    "id_user_creation" INTEGER NOT NULL,
    "id_user_end" INTEGER,
    "id_user_responsible" INTEGER,
    "id_client" INTEGER NOT NULL,
    "number_os" INTEGER NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."appointments" (
    "id" SERIAL NOT NULL,
    "date_time" TIMESTAMPTZ(6) NOT NULL,
    "content_html" TEXT NOT NULL,
    "id_user_appointment" INTEGER NOT NULL,
    "appointment_type" "odramech"."TypeAppointment" NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odramech"."archive_appointment" (
    "id" SERIAL NOT NULL,
    "id_archive" INTEGER NOT NULL,
    "id_appointment" INTEGER NOT NULL,
    "archive_type" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archive_appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cad_user_email_key" ON "odramech"."cad_user"("email");

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

-- AddForeignKey
ALTER TABLE "odramech"."work_orders" ADD CONSTRAINT "work_orders_id_user_creation_fkey" FOREIGN KEY ("id_user_creation") REFERENCES "odramech"."cad_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."work_orders" ADD CONSTRAINT "work_orders_id_user_end_fkey" FOREIGN KEY ("id_user_end") REFERENCES "odramech"."cad_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."work_orders" ADD CONSTRAINT "work_orders_id_user_responsible_fkey" FOREIGN KEY ("id_user_responsible") REFERENCES "odramech"."cad_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."work_orders" ADD CONSTRAINT "work_orders_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "odramech"."cad_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."appointments" ADD CONSTRAINT "appointments_id_user_appointment_fkey" FOREIGN KEY ("id_user_appointment") REFERENCES "odramech"."cad_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odramech"."archive_appointment" ADD CONSTRAINT "archive_appointment_id_appointment_fkey" FOREIGN KEY ("id_appointment") REFERENCES "odramech"."appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
