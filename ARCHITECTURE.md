# Arquitetura do Odramech

Três aplicações, cada uma com uma responsabilidade:

| App | Porta | O que faz | Banco |
|---|---|---|---|
| `odramech-frontend` (Angular 19) | 4200 | Interface da oficina | — |
| `odramech-backend` (NestJS) | 3004 | Regras da oficina: OS, orçamentos, clientes, financeiro | `odramech` (schema `odramech`) |
| `odramech-assinaturas` (NestJS) | 3010 | **Gerenciamento de Assinaturas Odramech**: planos, ciclos, faturas, pagamentos | `odramech_assinaturas` (schema `assinaturas`) |

```
 Navegador ──► Backend da oficina ──► (x-api-key) ──► Serviço de assinaturas
                    ▲                                        │
                    └──────── webhook (eventos) ◄────────────┘
```

O navegador **nunca** fala direto com o serviço de assinaturas: o backend da oficina autentica o
usuário, descobre a empresa pela sessão e repassa a chamada com uma chave de serviço.

---

## Padrões de projeto — onde e por quê

| # | Padrão | Onde | Problema que resolve |
|---|---|---|---|
| 1 | **Factory** | `backend/src/user/factories/user.factory.ts` | Cliente, mecânico e admin eram criados por dois métodos quase idênticos. Agora uma fábrica aplica política de "quem cria quem", hash de senha e normalização. Novo papel = 1 linha. |
| | | `backend/src/billing/factories/service-item.factory.ts` | Regra do item (desconto ≤ valor da linha) igual para orçamento e OS. |
| | | `backend/src/work-order/commands/work-order.commands.ts` (`WorkOrderCommandFactory`) | Cria comandos com suas dependências e checagem de permissão. |
| | | `assinaturas/src/domain/subscription.factory.ts` | Toda assinatura nasce num estado válido (teste grátis). |
| | | `backend/src/core/http/validation-pipe.factory.ts` | Monta o ValidationPipe com a política do projeto. |
| 2 | **Abstract Factory** | `assinaturas/src/payments/payment-provider.ts` + `sandbox/sandbox.provider.ts` | Um provedor de pagamento é uma **família** (gateway + parser de webhook). A fábrica garante que nunca se misture o gateway de um provedor com o parser de outro. Trocar de provedor = nova fábrica + 1 linha no `app.module`. |
| 3 | **Singleton** | `backend/src/core/config/app-config.ts`, `assinaturas/src/config/subscriptions-config.ts` | `.env` lido e validado **uma vez**, valores tipados. (Antes o `JWT_SECRET` só existia porque o Prisma carregava o `.env` "por acaso".) |
| | | `backend/src/core/core.module.ts` (`PrismaService` global) | **Antes havia 10 instâncias do PrismaClient (10 pools de conexão)**, uma por módulo. Agora uma só. |
| 4 | **Builder** | `backend/src/work-order/domain/work-order-criteria.ts` | Critério de busca de OS montado passo a passo, com a regra "cliente só vê as próprias OS" embutida no `for(auth)`. |
| | | `backend/src/billing/reports/financial-report.builder.ts` | Relatório financeiro por partes (receita, a receber, avaliações), consultas em paralelo só do que foi pedido. |
| | | `assinaturas/src/domain/invoice.builder.ts` | Fatura montada e validada (período calculado pela estratégia do ciclo). |
| | | `frontend/src/app/core/http/query-params.builder.ts` | Query strings sem `if` repetido em cada serviço. |
| 5 | **Strategy** | `assinaturas/src/domain/billing-cycle.strategy.ts` | Mensal × Anual: cálculo de período sem `if (interval === …)`. Trimestral = nova classe. |
| | | `assinaturas/src/payments/payment-method.strategy.ts` | Pix, Cartão e Boleto: cada um sabe cobrar. |
| | | `frontend/src/app/features/subscription/payment-method.strategies.ts` | O que mostrar por forma de pagamento. |
| | | `backend/src/work-order/domain/appointment-access.ts` | Quem escreve no histórico da OS: equipe (público + interno) × cliente (só público, só na própria OS e só se o estabelecimento liberou). Novo perfil = nova estratégia. |
| | | `backend/src/export/sources/*` | Cada documento exportável (OS, orçamentos, clientes, veículos, pagamentos) monta suas abas; o `ExportService` escolhe pelo tipo. Novo documento = nova classe na lista do módulo. |
| 6 | **Observer** | `backend/src/core/events/domain-event-bus.ts` + `work-order/listeners/status-timeline.listener.ts` | Mudou o status da OS → o histórico público ganha uma linha (o cliente acompanha). Quem muda o status não conhece quem reage. Falha de um listener não derruba a operação. |
| | | `assinaturas/src/events/*` | Todo evento de assinatura vai para auditoria (tabela `subscription_events`), console e webhook do backend. |
| | | `frontend/.../connection.service.ts` (RxJS) | Queda/volta da conexão notifica banner, layout e assinatura. |
| 7 | **Decorator** | `backend/src/subscription/gateway/caching-subscription.gateway.ts` | Cache da decisão de acesso **sem alterar** o gateway. Sem ele, cada clique viraria uma chamada HTTP ao serviço de assinaturas. |
| | | `backend/src/core/decorators/log-execution.decorator.ts`, `core/auth/current-auth.decorator.ts` | Log de lentidão por anotação; usuário da sessão tipado nos controllers. |
| | | `frontend/src/app/app.config.ts` (interceptors) | Cadeia que acrescenta comportamento a toda chamada HTTP (conexão, sessão, assinatura 402). |
| 8 | **Adapter** | `backend/src/subscription/gateway/http-subscription.gateway.ts` | Traduz a porta `SubscriptionGateway` para a API REST do serviço de assinaturas. |
| | | `assinaturas/src/payments/sandbox/sandbox.provider.ts` | Implementa a porta `PaymentGateway`. Mercado Pago/Asaas/Stripe entram como outros adapters. |
| | | `frontend/src/app/shared/services/zipcode.service.ts` | Formato da OpenCEP (`logradouro`, `uf`…) fica só nesse arquivo. |
| | | `backend/src/export/writers/exceljs-spreadsheet.writer.ts` | Porta `SpreadsheetWriter` → ExcelJS (.xlsx com formatos BR, filtro, total em fórmula, proteção contra fórmula injetada). Trocar o formato = outro writer. |
| | | `backend/src/work-order/adapters/settings-client-participation.adapter.ts` | A OS pergunta "cliente pode escrever?" por uma porta; o adapter responde com as configurações do estabelecimento. |
| | | `frontend/src/app/shared/media/camera-session.ts` | `getUserMedia` (câmera ao vivo + pedido de permissão) atrás de uma classe; sem https cai para a câmera nativa do celular. |
| 9 | **Facade** | `backend/src/dashboard/dashboard.facade.ts` | A tela inicial faz **uma** chamada; a fachada orquestra OS, financeiro e clientes. Também resolveu a dependência circular OS ↔ financeiro. |
| | | `backend/src/subscription/subscription.facade.ts` | Empresa da sessão, nome da empresa, permissão de admin e modo de cobrança numa interface simples. |
| | | `frontend/src/app/features/subscription/subscription.facade.ts` | Estado (signals) + operações da assinatura; componentes só apresentam. |
| | | `backend/src/export/export.service.ts` | Exportar = achar a fonte, aplicar estabelecimento/permissão, gerar o arquivo — o controller só devolve o download. |
| 10 | **Proxy** | `backend/src/subscription/gateway/resilient-subscription.proxy.ts` | Controla o acesso ao serviço remoto (circuit breaker). Serviço de assinaturas fora do ar **nunca para a oficina**: acesso em "falha aberta", demais operações com 503 claro. |
| | | `frontend/src/app/app.routes.ts` (lazy `loadComponent`) + `AuthGuard` | Proxy virtual (carrega a tela só quando acessada) e de proteção (exige sessão). |
| 11 | **Command** | `backend/src/core/commands/command-bus.ts` + `work-order/commands/*` | Mudar status/responsável da OS são comandos com **undo** (30 s). |
| | | `frontend/src/app/core/undo/*` | Barra "Desfazer" (Ctrl+Z). |
| | | `assinaturas/src/application/lifecycle.commands.ts` | Renovar, inadimplência, expirar e encerrar cancelamento são comandos executados por uma fila (`BillingJobQueue`) pelo agendador. |
| 12 | **Repository** | `backend/src/*/repositories/*` | Serviços dependem de abstrações (`WorkOrderRepository`, `QuoteRepository`…); o Prisma fica só nas implementações. |
| | | `assinaturas/src/repositories/*` | Versões **Prisma** e **em memória** do mesmo contrato: as regras de cobrança são testadas sem banco. |
| | | `frontend/src/app/core/http/api-repository.ts` | Base dos repositórios HTTP do front. |

A cadeia da integração de assinaturas mostra três padrões cooperando sobre a mesma interface:

```
SubscriptionFacade
  └─► CachingSubscriptionGateway     (Decorator — cache)
        └─► ResilientSubscriptionProxy (Proxy — circuit breaker / falha aberta)
              └─► HttpSubscriptionGateway (Adapter — REST + x-api-key)
```

---

## SOLID na prática

- **S — Responsabilidade única.** O antigo `BillingService` (orçamentos + itens + pagamentos + avaliações + notas + relatório) virou `QuoteService`, `WorkOrderMoneyService`, `NoteService` e `FinancialReportBuilder`. Controllers só traduzem HTTP.
- **O — Aberto/fechado.** Novo ciclo de cobrança, forma de pagamento, provedor de pagamento ou reação a evento de OS = **nova classe registrada**, sem editar as existentes.
- **L — Substituição de Liskov.** Repositórios Prisma e em memória, e o gateway real × cache × proxy, são intercambiáveis (os testes provam).
- **I — Segregação de interfaces.** Repositórios por agregado (`PaymentRepository` não tem métodos de orçamento).
- **D — Inversão de dependência.** Serviços dependem de classes abstratas (`WorkOrderRepository`, `SubscriptionGateway`, `PaymentGateway`, `Clock`); as ligações concretas ficam nos módulos.

---

## Assinaturas — regras

| Situação | Status | Acesso |
|---|---|---|
| Primeiro acesso da empresa | `TRIALING` (14 dias) | pleno |
| Pagou | `ACTIVE` | pleno |
| Período acabou sem pagamento | `PAST_DUE` | pleno até **7 dias** de tolerância |
| Tolerância esgotada | `EXPIRED` | **bloqueado** |
| Cancelou | agenda o fim; `CANCELED` na data | pleno até o fim do período pago |

- Planos: **Mensal R$ 149,90** e **Anual R$ 1.438,80** (= R$ 119,90/mês, 20% off). Ajuste em `odramech-assinaturas/prisma/seed.ts` e rode o seed de novo.
- A fatura de renovação é gerada **5 dias antes** do fim do período (`RENEWAL_LEAD_DAYS`).
- Pagamentos usam o provedor **sandbox** (nada é cobrado de verdade). Cartão: token `tok_recusado` simula recusa.
- `SUBSCRIPTION_ENFORCEMENT` no backend: `off` (ignora), `warn` (padrão local: só avisa) e `block` (empresa bloqueada fica **somente leitura**; as telas de assinatura continuam liberadas para regularizar).

### Plugar um provedor real (ex.: Mercado Pago)

1. Criar `assinaturas/src/payments/mercadopago/mercadopago.provider.ts` com `MercadoPagoGateway` (implements `PaymentGateway`), `MercadoPagoWebhookParser` (valida a assinatura do webhook) e `MercadoPagoProviderFactory`.
2. Em `app.module.ts` → `providerFactory()`, adicionar o `case 'mercadopago'`.
3. Adicionar as credenciais ao `.env` e ao schema do `SubscriptionsConfig`.

Nenhum serviço, regra ou tela precisa mudar.

---

## Estabelecimento escolhido na tela (sem trocar de login)

Quem é da equipe de vários estabelecimentos pode abrir dados de outro (ex.: ficha de cliente pela lista de clientes)
mandando `?establishmentId=`. O `EstablishmentScope` (`backend/src/core/auth/establishment-scope.service.ts`) confere
que a pessoa é da equipe de lá e usa o **papel que ela tem lá**. Usado em: ficha/edição de usuário, lista de OS,
cadastro/vínculo de veículo, cadastro de cliente e exportações. Abrir/criar OS continua exigindo entrar no estabelecimento.

---

## Testes

```bash
npm test
```

- Backend (15): Builder de critérios, Commands com undo, isolamento do Observer, Factories, Builder financeiro, Decorator de cache e Proxy de circuit breaker.
- Assinaturas (12): ciclos mensal/anual (inclusive 29/02), teste grátis, cartão aprovado/recusado, Pix + webhook idempotente, inadimplência → expiração, cancelamento agendado, renovação antecipada.

---

## Próximos passos sugeridos

- Levar Repository + `CurrentAuth` aos módulos menores ainda acessados direto pelo Prisma (`vehicle`, `enterprise`, `establishment`, `user-corporations`).
- Persistir o `CommandBus` (undo e auditoria) se o backend passar a rodar em mais de uma instância.
- Fila real (BullMQ/Redis) no lugar do agendador em memória quando houver várias instâncias do serviço de assinaturas.
