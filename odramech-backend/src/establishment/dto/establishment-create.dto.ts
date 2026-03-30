import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { AddressDTO } from "src/address/dto/address.dto";

export class EstablishmentCreateDTO {
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

    @IsNumber()
    enterpriseId: number

    @ValidateNested()
    @Type(() => AddressDTO)
    address: AddressDTO;
}