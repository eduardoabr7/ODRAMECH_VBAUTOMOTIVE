import { QuoteTemplate } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

/** data URL de imagem (PNG, JPG, WebP, GIF ou SVG) */
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** ~1 MB de imagem (base64 ≈ 4/3 do tamanho) */
export const MAX_LOGO_CHARS = 1_400_000;
/** ~3 MB de imagem */
export const MAX_LOGIN_IMAGE_CHARS = 4_200_000;
const MAX_HTML = 100_000;

export class QuoteDocumentSettingsDTO {
  @IsOptional() @IsEnum(QuoteTemplate)
  quoteTemplate?: QuoteTemplate;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(MAX_HTML)
  quoteHeaderHtml?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(MAX_HTML)
  quoteBodyHtml?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(MAX_HTML)
  quoteFooterHtml?: string | null;

  @IsOptional() @IsInt() @Min(1) @Max(365)
  quoteValidityDays?: number;

  @IsOptional() @IsBoolean()
  markQuoteSentOnPrint?: boolean;

  @IsOptional() @IsBoolean()
  autoEmailQuote?: boolean;
}

/** O que o cliente pode fazer na OS (por estabelecimento). */
export class WorkOrderSettingsDTO {
  @IsOptional() @IsBoolean()
  clientAppointmentsEnabled?: boolean;
}

/** Pré-visualização do documento com o rascunho da configuração (ainda não salvo). */
export class QuoteDocumentPreviewDTO {
  @IsEnum(QuoteTemplate)
  quoteTemplate: QuoteTemplate;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(MAX_HTML)
  quoteHeaderHtml?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(MAX_HTML)
  quoteBodyHtml?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(MAX_HTML)
  quoteFooterHtml?: string | null;

  @IsOptional() @IsInt() @Min(1) @Max(365)
  quoteValidityDays?: number;
}

export class BrandingDTO {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(60)
  displayName?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Matches(IMAGE_DATA_URL, { message: 'Logo deve ser uma imagem PNG, JPG, WebP, GIF ou SVG.' })
  @MaxLength(MAX_LOGO_CHARS, { message: 'Logo muito grande (máximo ~1 MB).' })
  logoUrl?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Matches(HEX_COLOR, { message: 'Cor inválida (use o formato #RRGGBB).' })
  accentColor?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Matches(IMAGE_DATA_URL, { message: 'Imagem de login deve ser PNG, JPG, WebP, GIF ou SVG.' })
  @MaxLength(MAX_LOGIN_IMAGE_CHARS, { message: 'Imagem de login muito grande (máximo ~3 MB).' })
  loginImageUrl?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(120)
  loginHeadline?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(240)
  loginSubtitle?: string | null;
}
