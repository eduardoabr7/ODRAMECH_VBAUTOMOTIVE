## 🛠️ ODRAMECH SOFTWARE

🎯 Objetivo do Sistema

O Odramech é uma solução SaaS (Software as a Service) completa e especializada, desenhada para simplificar a gestão de oficinas mecânicas e aprimorar a comunicação com os clientes. Nossa plataforma visa otimizar o fluxo de trabalho, desde o agendamento de serviços até o acompanhamento em tempo real, proporcionando uma experiência transparente e eficiente para todos os envolvidos.

## ✨ Funcionalidades Principais

Um panorama das principais funcionalidades que tornam o Odramech essencial para clientes e funcionários.

🚘 Para Clientes:

Acesso e Histórico de Serviços: Visualize informações detalhadas sobre todos os serviços realizados no seu veículo, incluindo datas, status e descrição dos trabalhos.

Acompanhamento em Tempo Real: Mantenha-se atualizado sobre o status do seu serviço (agendado, em andamento, aguardando peças, pronto, etc.) diretamente pelo aplicativo.

Comentários e Feedback: Adicione avaliações e comentários sobre o atendimento e os serviços prestados, ajudando a oficina a melhorar continuamente.

Veículos Cadastrados: Gerencie e visualize de forma fácil todos os veículos associados ao seu perfil de usuário.

⚙️ Para Funcionários:

Gestão de Serviços: Altere o status dos serviços de forma intuitiva, mantendo a equipe e os clientes sempre informados.

Comunicação Interna: Adicione comentários internos sobre o andamento do serviço, garantindo que toda a equipe esteja alinhada.

Histórico de Atendimento: Acesse o histórico completo de serviços de cada cliente para oferecer um atendimento personalizado e eficiente.

💻 Tecnologias Utilizadas

O Odramech é construído com um stack de tecnologias modernas e robustas, garantindo performance e escalabilidade.

Backend: Node.js com framework NEST.js para uma arquitetura modular e eficiente.

Comunicação: APIs RESTful para troca de dados segura e padronizada.

Frontend: Angular para uma interface de usuário dinâmica e responsiva.

Banco de Dados/ORM: Prisma para gestão e acesso simplificado ao banco de dados.

## 🚀 Guia de Configuração e Ambiente

Siga os passos abaixo para clonar o repositório e configurar o ambiente de desenvolvimento local.

Pré-requisito Essencial

⚠️ SEMPRE que clonar ou iniciar o desenvolvimento, rode o comando abaixo nas pastas odramech-backend e odramech-frontend para baixar as dependências do projeto.

```bash
npm install
```

1. Criação do Banco de Dados (PostgreSQL)

Utilize o Docker para criar uma instância local do PostgreSQL com as configurações necessárias:

```bash
docker run -d --name odramech -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=Sop1503 -e POSTGRES_DB=postgres -p 5432:5432 postgres:16
```

2. Configurar a String de Conexão

No arquivo .env localizado na raiz da pasta odramech-backend, defina a variável DATABASE_URL com a string de conexão do seu banco de dados.

```bash
DATABASE_URL="postgresql://postgres:Sop1503@localhost:5432/odramech?schema=odramech"
```

3. Executar as Migrações do Prisma

Execute o comando abaixo na pasta odramech-backend para criar as tabelas no banco de dados com base no schema do Prisma:

```bash
npx prisma migrate dev
```

![Screenshot Logo do Sistema Odramech](odramech-frontend/src/assets/logo_odramech.png)