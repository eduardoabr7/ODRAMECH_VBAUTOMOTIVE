import { OrderStatus, QuoteStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const STATUSES = [...Object.values(OrderStatus), ...Object.values(QuoteStatus)];

/** filtros aceitos por todas as exportações (cada uma usa os que fazem sentido) */
export class ExportQueryDTO {
  /** status da OS ou do orçamento, conforme o documento */
  @IsOptional() @IsIn(STATUSES)
  status?: string;

  @IsOptional() @IsString() @MaxLength(120)
  search?: string;

  /** período (data de abertura/pagamento), ISO yyyy-mm-dd */
  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  /** outro estabelecimento onde quem pede é da equipe */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  establishmentId?: number;
}

/** fim do dia de `to` (o filtro é inclusivo) */
export function periodOf(q: ExportQueryDTO): { gte?: Date; lte?: Date } | undefined {
  if (!q.from && !q.to) return undefined;
  const lte = q.to ? new Date(q.to) : undefined;
  lte?.setHours(23, 59, 59, 999);
  return { ...(q.from && { gte: new Date(q.from) }), ...(lte && { lte }) };
}
