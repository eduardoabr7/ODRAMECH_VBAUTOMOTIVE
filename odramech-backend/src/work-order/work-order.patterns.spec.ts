import { OrderStatus, Role } from '@prisma/client';
import { CommandBus } from 'src/core/commands/command-bus';
import { DomainEventBus } from 'src/core/events/domain-event-bus';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { WorkOrderCriteriaBuilder } from './domain/work-order-criteria';
import { WorkOrderStatusChanged } from './domain/work-order.events';
import { WorkOrderCommandFactory } from './commands/work-order.commands';
import { WorkOrderRepository } from './repositories/work-order.repository';

const staff: AuthPayload = { sub: 1, role: Role.WORKER, establishmentId: 10, enterpriseId: 5, context: 'AUTH' as any };
const client: AuthPayload = { ...staff, sub: 99, role: Role.USER };

/** repositório mínimo em memória (só o que os comandos usam) */
function fakeRepo(initial: OrderStatus) {
  const state = { status: initial, responsible: null as number | null, notes: [] as string[] };
  const repo = {
    findRef: async (id: number, est: number) => (est === 10 ? { id, numberOs: 7, status: state.status, userResponsibleId: state.responsible, establishmentId: 10 } : null),
    setStatus: async (_id: number, s: OrderStatus) => { state.status = s; },
    setResponsible: async (_id: number, u: number | null) => { state.responsible = u; },
    isStaffOf: async (u: number) => u !== 404,
    addAppointment: async (_id: number, _a: number, html: string) => { state.notes.push(html); return {}; },
  } as unknown as WorkOrderRepository;
  return { repo, state };
}

describe('WorkOrderCriteriaBuilder (Builder)', () => {
  it('cliente só enxerga as próprias OS, mesmo pedindo outro cliente', () => {
    const c = WorkOrderCriteriaBuilder.for(client).ofClient(123).withStatus(OrderStatus.PENDENTE).build();
    expect(c.onlyClientId).toBe(99);
    expect(c.establishmentId).toBe(10);
  });

  it('withoutStatus mantém a busca e remove o status (contagem por abas)', () => {
    const b = WorkOrderCriteriaBuilder.for(staff).withStatus(OrderStatus.FINALIZADA).matching('  abc1d23 ');
    expect(b.withoutStatus()).toEqual({ establishmentId: 10, term: 'abc1d23' });
    expect(b.build().status).toBe(OrderStatus.FINALIZADA);
  });
});

describe('Commands de OS + CommandBus (Command / Undo)', () => {
  it('muda status, publica evento e desfaz para o status anterior', async () => {
    const { repo, state } = fakeRepo(OrderStatus.PENDENTE);
    const events = new DomainEventBus();
    const seen: WorkOrderStatusChanged[] = [];
    events.subscribe(WorkOrderStatusChanged, { handle: e => { seen.push(e); } });

    const bus = new CommandBus();
    const factory = new WorkOrderCommandFactory(repo, events);

    const { undoToken } = await bus.dispatch(factory.changeStatus(staff, 1, OrderStatus.EM_ATENDIMENTO), staff.sub);
    expect(state.status).toBe(OrderStatus.EM_ATENDIMENTO);
    expect(undoToken).toBeTruthy();

    await bus.undo(undoToken!, staff.sub);
    expect(state.status).toBe(OrderStatus.PENDENTE);
    expect(seen.map(e => [e.from, e.to, e.reverted])).toEqual([
      [OrderStatus.PENDENTE, OrderStatus.EM_ATENDIMENTO, false],
      [OrderStatus.EM_ATENDIMENTO, OrderStatus.PENDENTE, true],
    ]);
  });

  it('desfazer só vale para quem executou e só uma vez', async () => {
    const { repo } = fakeRepo(OrderStatus.PENDENTE);
    const bus = new CommandBus();
    const factory = new WorkOrderCommandFactory(repo, new DomainEventBus());
    const { undoToken } = await bus.dispatch(factory.changeStatus(staff, 1, OrderStatus.FINALIZADA), staff.sub);

    await expect(bus.undo(undoToken!, 2)).rejects.toThrow();
    await bus.undo(undoToken!, staff.sub);
    await expect(bus.undo(undoToken!, staff.sub)).rejects.toThrow();
  });

  it('cliente não pode mudar status; responsável precisa ser da equipe', async () => {
    const { repo } = fakeRepo(OrderStatus.PENDENTE);
    const factory = new WorkOrderCommandFactory(repo, new DomainEventBus());
    expect(() => factory.changeStatus(client, 1, OrderStatus.FINALIZADA)).toThrow();
    await expect(factory.assignResponsible(staff, 1, 404).execute()).rejects.toThrow('colaborador');
  });

  it('listener com erro não derruba a operação (Observer isolado)', async () => {
    const { repo, state } = fakeRepo(OrderStatus.PENDENTE);
    const events = new DomainEventBus();
    events.subscribe(WorkOrderStatusChanged, { handle: () => { throw new Error('boom'); } });
    await new WorkOrderCommandFactory(repo, events).changeStatus(staff, 1, OrderStatus.AGUARDANDO_PECAS).execute();
    expect(state.status).toBe(OrderStatus.AGUARDANDO_PECAS);
  });
});
