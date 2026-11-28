import { FixedClock } from './clock';
import { ModuleContractNotifier, ModuleContractService } from './module-contract.service';
import { InMemoryModuleContractEventLog, InMemoryModuleContractRepository } from '../repositories/module-contract.repositories';
import { ContractModule } from '../domain/module-contract';

class RecordingNotifier extends ModuleContractNotifier {
  readonly calls: { enterpriseId: number; module: ContractModule; type: string }[] = [];
  async changed(enterpriseId: number, module: ContractModule, type: string) { this.calls.push({ enterpriseId, module, type }); }
}

const admin = { id: 1, email: 'dono@odramech.com' };

function setup() {
  const clock = new FixedClock(new Date('2026-03-01T12:00:00Z'));
  const repo = new InMemoryModuleContractRepository();
  const log = new InMemoryModuleContractEventLog();
  const notifier = new RecordingNotifier();
  return { clock, repo, log, notifier, service: new ModuleContractService(repo, log, notifier, clock) };
}

const inventory = async (s: ModuleContractService, id = 7) => (await s.access(id)).modules.find(m => m.module === 'INVENTORY')!;

describe('Contrato do módulo de estoque', () => {
  it('sem contrato o módulo fica fechado', async () => {
    const { service } = setup();
    expect((await inventory(service)).active).toBe(false);
  });

  it('ativar libera, avisa o backend e audita o autor', async () => {
    const { service, notifier, log } = setup();
    await service.activate(admin, 7, 'INVENTORY', { priceCents: 9900, endsAt: new Date('2026-04-01T00:00:00Z') });
    expect((await inventory(service)).active).toBe(true);
    expect(notifier.calls).toEqual([{ enterpriseId: 7, module: 'INVENTORY', type: 'module.contracted' }]);
    expect(log.rows[0].payload).toMatchObject({ actor: 'admin:1 dono@odramech.com' });
  });

  it('vence na data, sem esperar agendador', async () => {
    const { service, clock } = setup();
    await service.activate(admin, 7, 'INVENTORY', { endsAt: new Date('2026-03-05T00:00:00Z') });
    clock.advanceDays(5);
    const access = await inventory(service);
    expect(access.active).toBe(false);
    expect(access.reason).toMatch(/vencido/);
  });

  it('suspender fecha; reativar abre', async () => {
    const { service } = setup();
    await service.activate(admin, 7, 'INVENTORY', {});
    await service.suspend(admin, 7, 'INVENTORY', 'inadimplente');
    expect((await inventory(service)).active).toBe(false);
    await service.unsuspend(admin, 7, 'INVENTORY');
    expect((await inventory(service)).active).toBe(true);
  });

  it('encerrar fecha na hora e reativar cria um novo início', async () => {
    const { service, clock } = setup();
    await service.activate(admin, 7, 'INVENTORY', {});
    await service.cancel(admin, 7, 'INVENTORY');
    expect((await inventory(service)).active).toBe(false);
    clock.advanceDays(10);
    const { contract } = await service.activate(admin, 7, 'INVENTORY', { endsAt: null });
    expect(contract.startsAt.toISOString()).toBe('2026-03-11T12:00:00.000Z');
    expect((await inventory(service)).active).toBe(true);
  });

  it('contrato de uma empresa não vale para outra (isolamento de tenant)', async () => {
    const { service } = setup();
    await service.activate(admin, 7, 'INVENTORY', {});
    expect((await inventory(service, 8)).active).toBe(false);
  });

  it('o que vai para a oficina não carrega preço nem anotação interna', async () => {
    const { service } = setup();
    await service.activate(admin, 7, 'INVENTORY', { priceCents: 9900, note: 'desconto de lançamento' });
    const payload = JSON.stringify(await service.access(7));
    expect(payload).not.toMatch(/9900|desconto/);
  });

  it('recusa fim no passado ou antes do início', async () => {
    const { service } = setup();
    await expect(service.activate(admin, 7, 'INVENTORY', { endsAt: new Date('2026-02-01T00:00:00Z') })).rejects.toThrow(/fim do contrato/);
  });
});
