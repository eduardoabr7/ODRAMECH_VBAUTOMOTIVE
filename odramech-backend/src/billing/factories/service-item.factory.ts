import { BadRequestException } from '@nestjs/common';
import { round } from 'src/shared/utils/money.util';
import { ItemData } from '../repositories/billing.repositories';
import { ServiceItemDTO, UpdateServiceItemDTO } from '../dto/billing.dto';

/**
 * FACTORY — único ponto que transforma entrada do usuário em linha de item válida.
 * Normaliza texto/valores e aplica a regra de negócio (desconto não pode passar do valor da linha).
 * Usado por orçamentos e OS, então a regra vale igual nos dois lugares.
 */
export class ServiceItemFactory {
  static create(dto: ServiceItemDTO): ItemData {
    const item: ItemData = {
      kind: dto.kind,
      description: dto.description.trim().replace(/\s+/g, ' '),
      quantity: round(dto.quantity),
      unitPrice: round(dto.unitPrice),
      discount: round(dto.discount ?? 0),
    };
    ServiceItemFactory.assertValid(item);
    return item;
  }

  /** aplica um patch sobre o item atual e revalida o resultado */
  static patch(current: ItemData, dto: UpdateServiceItemDTO): Partial<ItemData> {
    const merged: ItemData = {
      kind: dto.kind ?? current.kind,
      description: dto.description?.trim().replace(/\s+/g, ' ') ?? current.description,
      quantity: dto.quantity !== undefined ? round(dto.quantity) : Number(current.quantity),
      unitPrice: dto.unitPrice !== undefined ? round(dto.unitPrice) : Number(current.unitPrice),
      discount: dto.discount !== undefined ? round(dto.discount) : Number(current.discount),
    };
    ServiceItemFactory.assertValid(merged);
    return merged;
  }

  private static assertValid(item: ItemData): void {
    if (!item.description) throw new BadRequestException('Descrição do item é obrigatória.');
    if (item.discount > round(item.quantity * item.unitPrice)) {
      throw new BadRequestException('O desconto não pode ser maior que o valor do item.');
    }
  }
}
