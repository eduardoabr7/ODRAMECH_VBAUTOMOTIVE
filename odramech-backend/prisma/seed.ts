import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const data = {
    name: "Administrador",
    email: "odramechenterprise@gmail.com",
    username: "admin",
    password: "odradmin",
}

async function userExists(username: string) {
    const user = await prisma.user.findUnique({
        where: { username }
    })
    return user
}

async function createAdmin() {
    try {
        const user = await prisma.user.create({ data })
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
