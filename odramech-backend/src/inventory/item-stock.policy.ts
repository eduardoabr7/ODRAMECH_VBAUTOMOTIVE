import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ItemKind } from '@prisma/client';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { PrismaService } from 'src/core/database/prisma.service';
import { ContractedModule } from 'src/contracted-modules/contracted-module';
import { ModuleAccessService, moduleRequired } from 'src/contracted-modules/module-access.service';
import { StockContext } from './domain/stock';

/**
 * Regras para um item de orçamento/OS apontar para uma peça do estoque.
 * Usado pelo módulo financeiro antes de gravar o item; a baixa em si é do StockLedger.
 */
@Injectable()
export class ItemStockPolicy {
  constructor(private readonly prisma: PrismaService, private readonly modules: ModuleAccessService) {}

  async context(auth: AuthPayload): Promise<StockContext> {
    return { moduleActive: await this.modules.isActive(auth.enterpriseId, ContractedModule.INVENTORY), userId: auth.sub };
  }

  /** vincular uma peça exige: módulo contratado, item do tipo PEÇA e peça ativa DESTE estabelecimento */
  async assertLinkable(auth: AuthPayload, ctx: StockContext, partId: number, kind: ItemKind): Promise<void> {
    if (!ctx.moduleActive) throw moduleRequired(ContractedModule.INVENTORY);
    if (kind !== ItemKind.PECA) throw new BadRequestException('Só itens do tipo Peça podem ser vinculados ao estoque.');
    const part = await this.prisma.part.findFirst({ where: { id: partId, establishmentId: auth.establishmentId, active: true }, select: { id: true } });
    // 404 também para peça de outro estabelecimento (não revela que existe)
    if (!part) throw new NotFoundException('Peça não encontrada no estoque deste estabelecimento.');
  }
}
