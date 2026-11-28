# Arquitetura do Odramech

Quatro aplicações, cada uma com uma responsabilidade:

| App | Porta | O que faz | Banco |
|---|---|---|---|
| `odramech-frontend` (Angular 19) | 4200 | Interface da oficina | — |
| `odramech-backend` (NestJS) | 3004 | Regras da oficina: OS, orçamentos, clientes, financeiro | `odramech` (schema `odramech`) |
| `odramech-assinaturas` (NestJS) | 3010 | **Gerenciamento de Assinaturas Odramech**: planos, ciclos, faturas, pagamentos | `odramech_assinaturas` (schema `assinaturas`) |
| `odramech-admin` (Angular 19) | 4300 | **Painel de licenças** (só o dono do sistema): cortesias, suspensão, planos, prazos, faturas, auditoria | — (fala com o serviço de assinaturas) |

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
| Primeiro acesso da empresa | `TRIALING` (**7 dias**, sem cartão) | pleno |
| Teste acabou sem pagar | `EXPIRED` **na hora** (sem tolerância) | **bloqueado** |
| Pagou (inclusive durante o teste) | `ACTIVE` no plano pago, a partir do pagamento | pleno |
| Período pago acabou sem pagamento | `PAST_DUE` | pleno até **7 dias** de tolerância |
| Tolerância esgotada | `EXPIRED` | **bloqueado** |
| Cancelou | agenda o fim; `CANCELED` na data | pleno até o fim do período pago |
| Cortesia (painel) | `ACTIVE` + `complimentary` | pleno, com ou sem prazo; venceu → bloqueado sem tolerância |
| Suspensa (painel) | qualquer + `suspended` | **bloqueado**, e a oficina não consegue pagar para sair |

- A decisão olha as **datas**, não só o status: teste/cortesia vencidos bloqueiam no mesmo instante, sem esperar o agendador.
- Escolher um plano **nunca** libera o plano antes de pagar (nem no teste).
- **Bloqueado = somente leitura de verdade**: no backend só passam as rotas marcadas com `@AllowWhenBlocked()` (consultas). Escritas, exportação, PDF/impressão, anexos e aprovação pelo link público recebem **402**. Rota nova nasce bloqueada.
- **Serviço de assinaturas fora do ar**: vale a última decisão conhecida de cada empresa (memória + tabela `subscription_access_snapshot`). Só empresa nunca vista entra em "falha aberta".
- **Webhook de pagamento**: assinatura HMAC sobre o corpo cru → a cobrança é **consultada no provedor** (`fetchCharge`) → valor e moeda precisam bater com a fatura (divergência gera `invoice.amount_mismatch` e não libera).
- **Sandbox em produção** (`NODE_ENV=production` + `PAYMENT_PROVIDER=sandbox`): nenhum pagamento é processado. Dá para operar só com teste grátis e cortesias até plugar o provedor real.
- Preços e recursos dos planos são editados no **painel** (o seed só cria os que faltam; `SEED_OVERWRITE_PLANS=true` força os valores do arquivo).
- A fatura de renovação é gerada **5 dias antes** do fim do período (`RENEWAL_LEAD_DAYS`).
- `SUBSCRIPTION_ENFORCEMENT` no backend: `off`, `warn` (só avisa) e `block` (use em produção).

## Painel de licenças (`odramech-admin`)

- Acesso só para administradores criados por linha de comando (não existe tela nem API de cadastro):
  `npm --prefix odramech-assinaturas run admin:create -- --email voce@dominio.com --name "Seu Nome" --totp`
  (`--reset-password`, `--totp` para ativar/trocar o 2FA, `--disable` para desativar e derrubar as sessões).
- Login: senha com scrypt, 2FA TOTP, 5 falhas por e-mail/IP → 15 min de bloqueio. Sessão em cookie `httpOnly` + `SameSite=Strict`, guardada como hash no banco (logout revoga). Toda escrita exige o header `x-odramech-admin: 1` (anti-CSRF).
- As rotas `/admin/*` do serviço de assinaturas aceitam **só** sessão de administrador — a `x-api-key` do backend não abre o painel.
- Toda ação vira evento na auditoria (`subscription_events`) com o autor, e avisa o backend para limpar o cache na hora.
- A anotação interna (`adminNote`) nunca é enviada para a oficina.
- **Produção**: sirva o build (`odramech-admin/dist/odramech-admin/browser`) num subdomínio próprio (ex.: `admin.seudominio.com`) e faça o Nginx encaminhar `/api/` → `http://127.0.0.1:3010/` (mesma origem, sem CORS). Exponha para a internet só `/api/admin/` e `/api/webhooks/payments`; o resto da porta 3010 fica interno. Se puder, restrinja o subdomínio por IP/VPN.

### Plugar um provedor real (ex.: Mercado Pago)

1. Criar `assinaturas/src/payments/mercadopago/mercadopago.provider.ts` com `MercadoPagoGateway` (implements `PaymentGateway`), `MercadoPagoWebhookParser` (valida a assinatura do webhook) e `MercadoPagoProviderFactory`.
2. Em `app.module.ts` → `providerFactory()`, adicionar o `case 'mercadopago'`.
3. Adicionar as credenciais ao `.env` e ao schema do `SubscriptionsConfig`.

Nenhum serviço, regra ou tela precisa mudar.

---

## Módulos contratados à parte — Estoque de peças

O Estoque é um **contrato separado da assinatura** (agregado próprio no serviço de assinaturas:
tabelas `module_contracts` e `module_contract_events`). O painel de licenças ativa, define prazo/valor,
suspende e encerra; tudo vai para a auditoria com o e‑mail do administrador e avisa o backend
(`POST /internal/module-contract-events`) para limpar o cache na hora.

| Para usar o módulo a empresa precisa de | Quem garante | Sem isso |
|---|---|---|
| Contrato do módulo ativo (dentro do prazo, não suspenso/encerrado) | `ModuleAccessGuard` global + `@RequiresModule('INVENTORY')` | **403** `MODULE_REQUIRED` (leitura e escrita) |
| Assinatura do Odramech ativa | `SubscriptionAccessGuard` | **402**; consultas com `@AllowWhenBlocked` continuam (somente leitura) |

- O menu/rota do frontend só **escondem** a tela (`GET /modules`); a proteção é do backend.
- A oficina recebe só `{ module, active, until, reason }` — preço e anotação interna nunca saem do serviço.
- Serviço de assinaturas fora do ar: vale a última situação conhecida (memória + `module_access_snapshot`).
  Empresa **nunca vista fica sem o módulo** (falha fechada — é um adicional pago).
- Encerrar o contrato **não apaga** peças nem histórico; reativar traz tudo de volta.

**Estoque** (`backend/src/inventory`): peças por estabelecimento (`inv_parts`) e livro‑razão imutável
(`inv_stock_movements`). O `StockLedger` é o único que altera saldo: saída por `UPDATE … WHERE quantity >= x`
(duas baixas simultâneas da última unidade → uma recebe 409) + `CHECK (quantity >= 0)` no banco.

| Evento | Estoque |
|---|---|
| Item de **orçamento** com peça | não baixa (só reserva o vínculo) |
| Converter orçamento em OS | baixa tudo na mesma transação; faltou saldo → 409 e **nada** é convertido |
| Item de **OS** com peça (incluir/alterar qtd./trocar peça/remover) | baixa ou devolve a diferença na mesma transação (`service_items.stock_quantity` guarda o que já saiu) |
| OS cancelada / reaberta (inclusive "desfazer") | devolve tudo / baixa de novo; na reabertura, peça sem saldo fica sem baixar e vira nota INTERNA na OS |
| Contrato vencido/suspenso | nada mais **sai** do estoque e não se vincula peça nova; devoluções continuam valendo |

Permissões: equipe consulta e lança entrada/saída; **cadastro, edição, desativação e ajuste de inventário só gestores**;
cliente nunca acessa. Ajuste exige motivo e usa checagem otimista (se o saldo mudou no meio, recusa).

Novo módulo vendido à parte = valor no enum `ContractModule` (assinaturas), em `ContractedModule` (backend)
e `@RequiresModule(...)` no controller.

---

## OS "ao vivo": quem está vendo + aviso de alteração

Push por **Server-Sent Events** (`GET /workorder/:id/live`), sem consulta periódica: cada tela de OS aberta
mantém UMA conexão, e o servidor só manda algo quando acontece alguma coisa. OS parada = zero consultas ao banco.

- **Quem está vendo** — abrir/fechar a conexão = entrar/sair da lista (`WorkOrderLiveHub`). Ícone de olho no
  cabeçalho da OS com as iniciais e a lista. Só a **equipe** recebe a lista; cliente nunca vê nomes da equipe.
- **Mudou a OS** — quem altera publica um evento de domínio (OBSERVER): `WorkOrderContentChanged` (apontamento,
  anexo, item, pagamento, avaliação), `WorkOrderStatusChanged` e `WorkOrderResponsibleChanged` (inclusive "desfazer").
  O hub avisa só quem está com aquela OS aberta → barra "Recarregar". Alteração feita por mim não acusa; nota
  interna não avisa o cliente. **Novo ponto que altera a OS precisa publicar `WorkOrderContentChanged`.**
- Proteções: o stream só abre com sessão válida e acesso à OS (senão 401/404); no máximo 20 conexões por usuário;
  `ping` a cada 25 s só para proxies (Nginx/Cloudflare) não derrubarem a conexão — não toca no banco.
- Com mais de uma instância do backend, os eventos precisam passar por um pub/sub compartilhado (ex.: Redis) —
  só o `WorkOrderLiveHub` muda.

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
