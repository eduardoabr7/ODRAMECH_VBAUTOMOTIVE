## ODRAMECH SOFTWARE

Objetivo do sistema
O Odramech é uma solução SaaS completa, criada para simplificar a gestão de oficinas mecânicas e aprimorar a comunicação com os clientes. Nossa plataforma visa otimizar o fluxo de trabalho, desde o agendamento de serviços até o acompanhamento em tempo real, proporcionando uma experiência transparente e eficiente para todos os envolvidos.

Funcionalidades Principais

  PARA CLIENTES:

    Acesso e Histórico de Serviços: Os clientes podem visualizar informações detalhadas sobre todos os serviços realizados em seus veículos, incluindo datas, status e descrição dos trabalhos.

    Acompanhamento em Tempo Real: Mantenha-se atualizado sobre o status do seu serviço (agendado, em andamento, aguardando peças, pronto etc.) diretamente pelo aplicativo.

    Comentários e Feedback: Adicione comentários e avaliações sobre o atendimento e os serviços prestados, ajudando a oficina a melhorar continuamente.

    Veículos Cadastrados: Gerencie e visualize todos os veículos associados ao seu perfil de usuário.

  PARA FUNCIONÁRIOS:

    Gestão de Serviços: Altere o status dos serviços de forma intuitiva, mantendo a equipe e os clientes sempre informados.

    Comunicação Interna: Adicione comentários internos sobre o andamento do serviço, garantindo que toda a equipe esteja na mesma página.

    Histórico de Atendimento: Acesse o histórico completo de serviços de cada cliente para oferecer um atendimento personalizado e eficiente.



TECNOLOGIAS UTILIZADAS:

    - Node.js
    - NEST.js
    - APIs RESTful
    - Angular
    - Prisma


CRIAÇÃO DO AMBIENTE:

## Antes de tudo:
## SEMPRE QUANDO FOR CLONAR ESTE REPOSITÓRIO, RODE ESTE COMANDO NA PASTA DO ODRAMECH-BACKEND E ODRAMECH-FRONTEND PARA BAIXAR AS DEPENDÊNCIAS 

```bash
npm install
```

## 1. Crie uma instância do Postgres no bash
```bash
docker run -d --name odramech -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=Sop1503 -e POSTGRES_DB=postgres -p 5432:5432 postgres:16
```

## 2. Configurar o Banco de Dados

No arquivo .env na raiz da pasta odramech-backend, defina a variável DATABASE_URL com a string de conexão do seu banco PostgreSQL. Exemplo:

```bash
DATABASE_URL="postgresql://postgres:Sop1503@localhost:5432/odramech?schema=odramech"
```

## 3. Fazer a criação do banco de dados com prisma
 npx prisma migrate dev