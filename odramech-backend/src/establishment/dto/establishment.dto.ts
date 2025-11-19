import { Type } from "class-transformer";
import { IsOptional, IsString, ValidateNested } from "class-validator";
import { AddressDTO } from "src/address/dto/address.dto";

export class EstablishmentDTO {
    @IsString()
    @IsOptional()
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

    @ValidateNested()
    @Type(() => AddressDTO)
    address: AddressDTO;
}