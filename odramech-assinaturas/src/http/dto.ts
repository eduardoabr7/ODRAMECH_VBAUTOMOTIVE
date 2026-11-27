import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const METHODS = ['PIX', 'CARD', 'BOLETO'] as const;

export class OverviewQueryDTO {
  @IsOptional() @IsString() @MaxLength(200)
  enterpriseName?: string;
}

export class SelectPlanDTO {
  @IsString() @MaxLength(40)
  planCode: string;

  @IsIn(METHODS)
  method: 'PIX' | 'CARD' | 'BOLETO';
}

export class PayInvoiceDTO {
  @IsIn(METHODS)
  method: 'PIX' | 'CARD' | 'BOLETO';

  @IsOptional() @IsString() @MaxLength(200)
  cardToken?: string;
}
