import { Logger } from '@nestjs/common';

/** Empresa cadastrada no sistema da oficina (o painel mostra quem ainda nem tem assinatura). */
export interface DirectoryEnterprise {
  id: number;
  name: string;
  cnpj: string;
  email: string;
  phone: string;
}

/** Porta: de onde vêm as empresas da oficina. */
export abstract class EnterpriseDirectory {
  /** null = backend da oficina indisponível (o painel segue funcionando só com as assinaturas) */
  abstract list(): Promise<DirectoryEnterprise[] | null>;
}

/** ADAPTER — GET {backend}/internal/enterprises com a mesma x-api-key usada entre os serviços. */
export class HttpEnterpriseDirectory extends EnterpriseDirectory {
  private readonly logger = new Logger('EnterpriseDirectory');
  constructor(private readonly baseUrl: string | null, private readonly apiKey: string) { super(); }

  async list(): Promise<DirectoryEnterprise[] | null> {
    if (!this.baseUrl) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(`${this.baseUrl}/internal/enterprises`, { headers: { 'x-api-key': this.apiKey }, signal: ctrl.signal });
      if (!res.ok) {
        this.logger.warn(`Backend da oficina respondeu ${res.status} ao listar empresas`);
        return null;
      }
      return (await res.json()) as DirectoryEnterprise[];
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class StaticEnterpriseDirectory extends EnterpriseDirectory {
  constructor(private readonly rows: DirectoryEnterprise[] | null) { super(); }
  async list() { return this.rows; }
}
