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
    username: "admin",
    password: ""
}

async function userExists(username: string) {
    const user = await prisma.user.findUnique({
        where: { username }
    })
    return user
}

async function createAdmin() {
    try {
        const user = await prisma.user.create({ data: {
            ...data,
            password: await getHashedPassword()
        } });
        console.log(`Usuário inicial ${data.username} criado com sucesso`)
    } catch (err) {
        if (err instanceof Error) {
            console.error(`Erro ao criar o usuário ${data.username}:`, err.message)
        } else {
            console.error("Erro inesperado: ", err)
        }
    }
}

async function main() {
    if (await userExists(data.username)) {
        console.log(`Usuário ${data.username} já existe. Nenhuma ação necessária.`)
    } else {
        await createAdmin()
    }

    await prisma.$disconnect()
}

main()
