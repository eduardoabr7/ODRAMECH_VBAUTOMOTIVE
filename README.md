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

## 🚀 Rodando na sua máquina (Windows)

**Pré-requisito único:** [Node.js 22 LTS](https://nodejs.org). Não precisa instalar PostgreSQL nem Docker.

1. Dê dois cliques em **`iniciar.bat`** na raiz do projeto.
   - Na primeira vez ele roda o setup sozinho: instala dependências, cria o banco local, aplica as migrations e o seed.
   - Depois sobe **banco + serviço de assinaturas (porta 3010) + backend (porta 3004) + frontend (porta 4200)** e abre o navegador.
2. Entre com `odramechenterprise@gmail.com` / `odramin`.
3. `Ctrl+C` na janela encerra tudo.

| Comando (na raiz) | O que faz |
|---|---|
| `setup.bat` ou `npm run setup` | Instala/atualiza tudo e aplica migrations + seed |
| `iniciar.bat` ou `npm run dev` | Sobe banco, backend e frontend juntos |
| `npm run db` | Sobe só o banco |
| `npm run db:reset` | **Apaga** o banco local e recria do zero |
| `npm test` | Testes do backend e do serviço de assinaturas |

> Arquitetura, padrões de projeto e regras de assinatura: veja **[ARCHITECTURE.md](ARCHITECTURE.md)**.

### Banco de dados

- Por padrão é usado um **PostgreSQL embutido** (pacote `embedded-postgres`), com os dados em `.data/postgres` (fora do git).
- Se já houver um PostgreSQL na porta da `DATABASE_URL` (instalado ou Docker), ele é usado no lugar.
- Prefere Docker? `docker compose up -d` sobe um Postgres 16 com as mesmas credenciais.

### Variáveis de ambiente

- `odramech-backend/.env` (modelo em `.env.example`): porta, `DATABASE_URL`, JWT e origem do frontend (CORS).
- `odramech-frontend/.env` (modelo em `.env.example`): host e porta do backend. O `environment.ts` é **gerado** a partir dele a cada `npm start` / `npm run build`.
- Anexos dos apontamentos ficam em `odramech-backend/uploads` (configurável com `UPLOAD_DIR`).

### Rodando manualmente (sem os scripts)

```bash
cd odramech-backend && npm install && npx prisma migrate deploy && npm run start:dev
```

```bash
cd odramech-frontend && npm install --legacy-peer-deps && npm start
```

> Com npm 11+, rode também `npm rebuild bcrypt @prisma/engines prisma @prisma/client` no backend — o npm passou a bloquear scripts de instalação.

![Logo do Odramech](odramech-frontend/src/assets/logo_odramech-orange.png)