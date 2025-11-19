import { Type } from "class-transformer";
import { IsOptional, IsString, ValidateNested } from "class-validator";
import { AddressDTO } from "src/address/dto/address.dto";

export class EnterpriseDTO {
    @IsString()
    @IsOptional()
    logoUrl?: string | null

    @IsString()
    name: string

    @IsString()
    email: string

    @IsString()
    phone: string

    @IsString()
    cnpj: string
    
    @ValidateNested()
    @Type(() => AddressDTO)
    address: AddressDTO;
}