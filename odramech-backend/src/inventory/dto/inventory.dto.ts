import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { PART_UNITS, PartUnit } from '../domain/stock';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const MAX_QTY = 1_000_000;
const MAX_PRICE = 10_000_000;

export class PartCreateDTO {
  @IsOptional() @Transform(trim) @IsString() @Matches(/^[\w.\-/ ]{1,40}$/, { message: 'Código: até 40 letras, números, espaço, ponto, hífen, barra ou _.' })
  code?: string;

  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120)
  name: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(60)
  brand?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(60)
  oemCode?: string;

  @IsOptional() @IsIn(PART_UNITS)
  unit?: PartUnit;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_PRICE)
  costPrice?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_PRICE)
  salePrice?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_QTY)
  minQuantity?: number;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(60)
  location?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000)
  notes?: string;

  /** saldo inicial — vira uma movimentação de ENTRADA (o saldo nunca é gravado "na mão") */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_QTY)
  initialQuantity?: number;
}

/** edição de cadastro — saldo NÃO muda por aqui (só por movimentação) */
export class PartUpdateDTO {
  @IsOptional() @Transform(trim) @IsString() @Matches(/^[\w.\-/ ]{0,40}$/, { message: 'Código: até 40 letras, números, espaço, ponto, hífen, barra ou _.' })
  code?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) brand?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) oemCode?: string;
  @IsOptional() @IsIn(PART_UNITS) unit?: PartUnit;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_PRICE) costPrice?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_PRICE) salePrice?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_QTY) minQuantity?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) location?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) notes?: string;
}

export class PartStatusDTO {
  @IsBoolean() active: boolean;
}

export const MANUAL_MOVEMENTS = ['ENTRADA', 'SAIDA', 'AJUSTE'] as const;
export type ManualMovement = (typeof MANUAL_MOVEMENTS)[number];

export class StockMovementDTO {
  @IsIn(MANUAL_MOVEMENTS)
  type: ManualMovement;

  /** ENTRADA/SAIDA: quantidade movimentada. AJUSTE: saldo contado (o novo saldo). */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_QTY)
  quantity: number;

  /** custo unitário da compra (ENTRADA) — atualiza o custo da peça */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_PRICE)
  unitCost?: number;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  note?: string;
}

export class PartListQueryDTO {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  /** só peças no mínimo ou abaixo */
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() lowStock?: boolean;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() includeInactive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class MovementListQueryDTO {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) partId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
