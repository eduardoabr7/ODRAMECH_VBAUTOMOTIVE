import { MessageEvent } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { DomainEventBus } from 'src/core/events/domain-event-bus';
import { WorkOrderContentChanged, WorkOrderStatusChanged } from '../domain/work-order.events';
import { MAX_CONNECTIONS_PER_USER, WorkOrderLiveHub } from './work-order-live.hub';

const ana = { userId: 1, name: 'Ana', kind: 'STAFF' as const };
const bruno = { userId: 2, name: 'Bruno', kind: 'STAFF' as const };
const maria = { userId: 9, name: 'Maria', kind: 'CLIENT' as const };

function setup() {
  const bus = new DomainEventBus();
  const hub = new WorkOrderLiveHub(bus);
  hub.onModuleInit();
  const subs: Subscription[] = [];
  const open = (wo: number, viewer: typeof ana | typeof maria, staff: boolean) => {
    const got: any[] = [];
    subs.push(hub.connect(wo, viewer, staff).subscribe((m: MessageEvent) => got.push(m.data)));
    return { got, close: () => subs.pop()!.unsubscribe() };
  };
  return { bus, hub, open, done: () => subs.forEach(s => s.unsubscribe()) };
}

const lastViewers = (got: any[]) => [...got].reverse().find(m => m.type === 'viewers')?.viewers.map((v: any) => v.name);

describe('WorkOrderLiveHub — OS ao vivo por push (SSE)', () => {
  it('quem entra aparece para a equipe; quem fecha a tela some na hora', () => {
    const { open, done } = setup();
    const a = open(7, ana, true);
    const b = open(7, bruno, true);
    expect(lastViewers(a.got)).toEqual(['Ana', 'Bruno']);
    b.close();
    expect(lastViewers(a.got)).toEqual(['Ana']);
    done();
  });

  it('alteração avisa só quem está com AQUELA OS aberta', async () => {
    const { bus, open, done } = setup();
    const a = open(7, ana, true);
    const other = open(8, bruno, true);
    await bus.publish(new WorkOrderContentChanged(7, bruno.userId));
    expect(a.got.filter(m => m.type === 'changed')).toEqual([{ type: 'changed', by: 2 }]);
    expect(other.got.some(m => m.type === 'changed')).toBe(false);
    done();
  });

  it('mudança de status também avisa', async () => {
    const { bus, open, done } = setup();
    const a = open(7, ana, true);
    await bus.publish(new WorkOrderStatusChanged(7, 'PENDENTE', 'EM_ATENDIMENTO', bruno.userId));
    expect(a.got.some(m => m.type === 'changed' && m.by === 2)).toBe(true);
    done();
  });

  it('cliente não recebe nomes da equipe nem aviso de nota interna', async () => {
    const { bus, open, done } = setup();
    open(7, ana, true);
    const c = open(7, maria, false);
    await bus.publish(new WorkOrderContentChanged(7, ana.userId, true));
    expect(c.got.some(m => m.type === 'viewers')).toBe(false);
    expect(c.got.some(m => m.type === 'changed')).toBe(false);
    await bus.publish(new WorkOrderContentChanged(7, ana.userId, false));
    expect(c.got.some(m => m.type === 'changed')).toBe(true);
    done();
  });

  it('a mesma pessoa em várias abas conta uma vez', () => {
    const { hub, open, done } = setup();
    open(7, ana, true);
    open(7, ana, true);
    expect(hub.viewers(7)).toHaveLength(1);
    done();
  });

  it('limita conexões por pessoa (proteção contra esgotar o servidor)', () => {
    const { hub, open, done } = setup();
    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) open(i, ana, true);
    expect(() => hub.connect(999, ana, true)).toThrow(/Muitas telas/);
    done();
  });
});
