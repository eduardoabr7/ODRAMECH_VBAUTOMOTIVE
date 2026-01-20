import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { AddressDTO } from "src/address/dto/address.dto";

export class EstablishmentListDTO {
    @IsNumber()
    id: number

    @IsString()
    @IsOptional()
    logoUrl: string | null

    @IsString()
    name: string

    @ValidateNested()
    @Type(() => AddressDTO)
    address: AddressDTO;
}