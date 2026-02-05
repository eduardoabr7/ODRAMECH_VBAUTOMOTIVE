import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();
const saltRounds = 11;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, saltRounds);
}

const ADMIN_EMAIL = "odramechenterprise@gmail.com";
const ADMIN_PASSWORD = "odramin";

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
      gender: 'M',
      password: await hashPassword(ADMIN_PASSWORD),
      principalPhone: "119999999",
    },
  });

  /* =========================
     ADDRESS (GENÉRICO)
  ==========================*/
  const address = await prisma.address.create({
    data: {
      street: "Rua Exemplo",
      number: "123",
      district: "Centro",
      city: "São Paulo",
      zipCode: "00000-000",
      country: "BR",
      neighborhood: 'Aparecida'
    },
  });

  /* =========================
     ENTERPRISE
  ==========================*/
  const enterprise = await prisma.enterprise.upsert({
    where: { cnpj: "00.000.000/0001-00" },
    update: {},
    create: {
      name: "Empresa Genérica",
      email: "empresa@odramech.com",
      phone: "11333333",
      cnpj: "00.000.000/0001-00",
      addressId: address.id,
    },
  });

  /* =========================
     ESTABLISHMENT
  ==========================*/
  const establishment = await prisma.establishment.upsert({
    where: { cnpj: "11.111.111/0001-11" },
    update: {},
    create: {
      name: "Estabelecimento Genérico",
      email: "estabelecimento@odramech.com",
      phone: "11444444",
      cnpj: "11.111.111/0001-11",
      addressId: address.id,
    },
  });

  /* =========================
     ENTERPRISE ↔ ESTABLISHMENT
  ==========================*/
  await prisma.enterpriseEstablishment.upsert({
    where: {
      idEnterprise_idEstablishment: {
        idEnterprise: enterprise.id,
        idEstablishment: establishment.id,
      },
    },
    update: {},
    create: {
      idEnterprise: enterprise.id,
      idEstablishment: establishment.id,
    },
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
