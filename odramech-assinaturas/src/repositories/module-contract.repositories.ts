import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ContractModule, ModuleContract, NewModuleContract } from '../domain/module-contract';
import { PrismaService } from './prisma.repositories';

/** REPOSITORY (porta) dos contratos de módulo — separado do agregado Assinatura. */
export abstract class ModuleContractRepository {
  abstract find(enterpriseId: number, module: ContractModule): Promise<ModuleContract | null>;
  abstract listByEnterprise(enterpriseId: number): Promise<ModuleContract[]>;
  abstract listAll(): Promise<ModuleContract[]>;
  abstract create(data: NewModuleContract): Promise<ModuleContract>;
  abstract update(id: string, data: Partial<NewModuleContract>): Promise<ModuleContract>;
}

export interface LoggedModuleEvent {
  id: number;
  contractId: string;
  type: string;
  payload: unknown;
  createdAt: Date;
}

export abstract class ModuleContractEventLog {
  abstract append(contractId: string, type: string, payload: unknown): Promise<void>;
  abstract listByContract(contractId: string, take: number): Promise<LoggedModuleEvent[]>;
}

// ── Prisma ──────────────────────────────────────────────────

const json = (v: unknown) => (v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

@Injectable()
export class PrismaModuleContractRepository extends ModuleContractRepository {
  constructor(private readonly db: PrismaService) { super(); }
  find(enterpriseId: number, module: ContractModule) {
    return this.db.moduleContract.findUnique({ where: { enterpriseId_module: { enterpriseId, module } } });
  }
  listByEnterprise(enterpriseId: number) {
    return this.db.moduleContract.findMany({ where: { enterpriseId }, orderBy: { module: 'asc' } });
  }
  listAll() {
    return this.db.moduleContract.findMany({ orderBy: { enterpriseId: 'asc' } });
  }
  create(data: NewModuleContract) {
    return this.db.moduleContract.create({ data });
  }
  update(id: string, data: Partial<NewModuleContract>) {
    return this.db.moduleContract.update({ where: { id }, data });
  }
}

@Injectable()
export class PrismaModuleContractEventLog extends ModuleContractEventLog {
  constructor(private readonly db: PrismaService) { super(); }
  async append(contractId: string, type: string, payload: unknown) {
    await this.db.moduleContractEvent.create({ data: { contractId, type, payload: json(payload) } });
  }
  listByContract(contractId: string, take: number) {
    return this.db.moduleContractEvent.findMany({ where: { contractId }, orderBy: { createdAt: 'desc' }, take });
  }
}

// ── Em memória (testes) ─────────────────────────────────────

export class InMemoryModuleContractRepository extends ModuleContractRepository {
  readonly rows: ModuleContract[] = [];
  async find(enterpriseId: number, module: ContractModule) {
    const r = this.rows.find(c => c.enterpriseId === enterpriseId && c.module === module);
    return r ? { ...r } : null;
  }
  async listByEnterprise(enterpriseId: number) { return this.rows.filter(c => c.enterpriseId === enterpriseId).map(c => ({ ...c })); }
  async listAll() { return this.rows.map(c => ({ ...c })); }
  async create(data: NewModuleContract) {
    if (this.rows.some(c => c.enterpriseId === data.enterpriseId && c.module === data.module)) throw new Error('unique');
    const row: ModuleContract = { ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
    this.rows.push(row);
    return { ...row };
  }
  async update(id: string, data: Partial<NewModuleContract>) {
    const row = this.rows.find(c => c.id === id);
    if (!row) throw new Error('not found');
    Object.assign(row, data, { updatedAt: new Date() });
    return { ...row };
  }
}

export class InMemoryModuleContractEventLog extends ModuleContractEventLog {
  readonly rows: LoggedModuleEvent[] = [];
  async append(contractId: string, type: string, payload: unknown) {
    this.rows.push({ id: this.rows.length + 1, contractId, type, payload, createdAt: new Date() });
  }
  async listByContract(contractId: string, take: number) {
    return this.rows.filter(e => e.contractId === contractId).reverse().slice(0, take);
  }
}
