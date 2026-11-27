import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Matches, MaxLength, ValidateIf, ValidateNested } from "class-validator";
import { ESTABLISHMENT_PHOTO, MAX_PHOTO_CHARS } from "./establishment-update.dto";
import { AddressDTO } from "src/address/dto/address.dto";

export class EstablishmentCreateDTO {
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @Matches(ESTABLISHMENT_PHOTO, { message: 'A foto deve ser PNG, JPG ou WebP.' })
    @MaxLength(MAX_PHOTO_CHARS, { message: 'Foto muito grande (máximo ~1 MB).' })
    logoUrl?: string | null

    @IsString()
    name: string

    @IsString()
    @IsOptional()
    email?: string | null

    @IsString()
    phone: string

    @IsString()
    cnpj: string

    @IsNumber()
    enterpriseId: number

    @ValidateNested()
    @Type(() => AddressDTO)
    address: AddressDTO;
}