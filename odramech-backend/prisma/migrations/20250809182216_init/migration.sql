-- CreateTable
CREATE TABLE "odramech"."cad_usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "cad_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cad_usuario_username_key" ON "odramech"."cad_usuario"("username");
