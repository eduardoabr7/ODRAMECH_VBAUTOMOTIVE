import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export class AdminLoginDTO {
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @MinLength(1) @MaxLength(200) password: string;
  @IsOptional() @IsString() @MaxLength(10) totp?: string;
}

export class StartTrialDTO {
  @IsOptional() @IsInt() @Min(1) @Max(365) days?: number;
  @IsOptional() @IsString() @MaxLength(200) enterpriseName?: string;
}

export class ComplimentaryDTO {
  @IsString() @MaxLength(40) planCode: string;
  /** ISO; ausente/null = sem prazo */
  @IsOptional() @IsDateString() until?: string | null;
  @IsOptional() @IsString() @MaxLength(200) enterpriseName?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ChangePlanDTO {
  @IsString() @MaxLength(40) planCode: string;
}

export class PeriodDTO {
  @IsDateString() until: string;
  @IsOptional() @IsIn(['TRIALING', 'ACTIVE']) status?: 'TRIALING' | 'ACTIVE';
}

export class SuspendDTO {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class NoteDTO {
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class UpdatePlanDTO {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) priceCents?: number;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) sortOrder?: number;
  @IsOptional() @IsInt() @Min(1) @Max(20) tier?: number;
  /** null = ilimitado */
  @IsOptional() @IsInt() @Min(1) @Max(1000) maxEstablishments?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(60, { each: true }) features?: string[];
}

export class CreatePlanDTO extends UpdatePlanDTO {
  @Matches(/^[A-Z0-9_]{2,40}$/, { message: 'Código: letras maiúsculas, números e _ (ex.: PRO_ANUAL).' }) code: string;
  @IsString() @MinLength(2) @MaxLength(60) declare name: string;
  @IsInt() @Min(0) @Max(100_000_000) declare priceCents: number;
  @IsIn(['MONTHLY', 'YEARLY']) interval: 'MONTHLY' | 'YEARLY';
}

export class ModuleContractDTO {
  /** ISO; ausente = mantém (ou agora, num contrato novo) */
  @IsOptional() @IsDateString() startsAt?: string;
  /** ISO; null = sem prazo; ausente = mantém */
  @IsOptional() @IsDateString() endsAt?: string | null;
  /** valor acordado em centavos (só registro); null = não informado */
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) priceCents?: number | null;
  @IsOptional() @IsString() @MaxLength(200) enterpriseName?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
