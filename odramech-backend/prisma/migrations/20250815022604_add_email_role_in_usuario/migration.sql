/*
  Warnings:

  - Added the required column `email` to the `cad_usuario` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `cad_usuario` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "odramech"."cad_usuario" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "role" TEXT NOT NULL;
