import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();
const saltRounds = 11;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, saltRounds);
}

const ADMIN_EMAIL = "odramechenterprise@gmail.com";
const ADMIN_PASSWORD = "odramin";

const ENTERPRISE_CNPJ = "00.000.000/0001-00";
const ESTABLISHMENT_CNPJ = "11.111.111/0001-11";

const baseAddress = {
  street: "Rua Exemplo",
  district: "Centro",
  city: "São Paulo",
  zipCode: "00000-000",
  country: "BR",
  neighborhood: "Aparecida",
};

// Idempotente: pode rodar a cada start sem duplicar endereços ou registros.
async function main() {
  /* =========================
     USER (ADMIN)
  ==========================*/
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      name: "Administrador",
      email: ADMIN_EMAIL,
      gender: "M",
      password: await hashPassword(ADMIN_PASSWORD),
      principalPhone: "119999999",
    },
  });

  /* =========================
     ENTERPRISE
  ==========================*/
  const enterprise =
    (await prisma.enterprise.findUnique({ where: { cnpj: ENTERPRISE_CNPJ } })) ??
    (await prisma.enterprise.create({
      data: {
        name: "Empresa Genérica",
        email: "empresa@odramech.com",
        phone: "11333333",
        cnpj: ENTERPRISE_CNPJ,
        address: { create: { ...baseAddress, number: "123" } },
      },
    }));

  /* =========================
     ESTABLISHMENT (+ contador de OS/orçamentos)
  ==========================*/
  const establishment =
    (await prisma.establishment.findUnique({ where: { cnpj: ESTABLISHMENT_CNPJ } })) ??
    (await prisma.establishment.create({
      data: {
        name: "Estabelecimento Genérico",
        email: "estabelecimento@odramech.com",
        phone: "11444444",
        cnpj: ESTABLISHMENT_CNPJ,
        enterprise: { connect: { id: enterprise.id } },
        address: { create: { ...baseAddress, number: "456" } },
      },
    }));

  await prisma.establishmentOsCounter.upsert({
    where: { establishmentId: establishment.id },
    update: {},
    create: { establishmentId: establishment.id },
  });

  /* =========================
     USER ↔ CORPORATION (ADMIN)
  ==========================*/
  await prisma.userCorporation.upsert({
    where: {
      idUser_idEnterprise_idEstablishment: {
        idUser: adminUser.id,
        idEnterprise: enterprise.id,
        idEstablishment: establishment.id,
      },
    },
    update: {
      role: Role.ADMIN,
    },
    create: {
      idUser: adminUser.id,
      idEnterprise: enterprise.id,
      idEstablishment: establishment.id,
      role: Role.ADMIN,
    },
  });

  console.log("✅ Seed inicial executado com sucesso");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
