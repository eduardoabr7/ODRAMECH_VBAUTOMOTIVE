import { PrismaClient } from "@prisma/client"
import { CreateUserDto } from "../src/user/dto/create-user.dto";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const saltRounds = 11;

async function hashPassword(password): Promise<string> {
    return await bcrypt.hash(password, saltRounds);
}

async function getHashedPassword() {
  return await hashPassword("odramin");
}

const data = {
    id: 1,
    name: "Administrador",
    email: "odramechenterprise@gmail.com",
}

async function userExists(email: string) {
    const user = await prisma.user.findUnique({
        where: { email }
    })
    return user
}

async function createAdmin() {
    try {
        const user = await prisma.user.create({ data: {
            ...data,
            password: await getHashedPassword()
        } });
        console.log(`Usuário inicial criado com sucesso`)
    } catch (err) {
        if (err instanceof Error) {
            console.error(`Erro ao criar o usuário administrador:`, err.message)
        } else {
            console.error("Erro inesperado: ", err)
        }
    }
}

async function main() {
    if (await userExists(data.email)) {
        console.log(`Usuário administrador já existe. Nenhuma ação necessária.`)
    } else {
        await createAdmin()
    }

    await prisma.$disconnect()
}

main()
