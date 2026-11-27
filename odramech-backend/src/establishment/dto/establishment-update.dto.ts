import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { AddressDTO } from 'src/address/dto/address.dto';

/** foto do estabelecimento: data URL de imagem (PNG, JPG ou WebP), já reduzida no navegador */
export const ESTABLISHMENT_PHOTO = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/;
/** ~1 MB de imagem */
export const MAX_PHOTO_CHARS = 1_400_000;

export class EstablishmentUpdateDTO {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  name?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsEmail({}, { message: 'E-mail inválido.' })
  email?: string | null;

  @IsOptional() @IsString() @MinLength(8) @MaxLength(20)
  phone?: string;

  @IsOptional() @IsString() @MinLength(14) @MaxLength(18)
  cnpj?: string;

  /** null = remove a foto */
  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Matches(ESTABLISHMENT_PHOTO, { message: 'A foto deve ser PNG, JPG ou WebP.' })
  @MaxLength(MAX_PHOTO_CHARS, { message: 'Foto muito grande (máximo ~1 MB).' })
  logoUrl?: string | null;

  @IsOptional() @ValidateNested() @Type(() => AddressDTO)
  address?: AddressDTO;
}
