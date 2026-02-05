import { IsInt, IsNumber, IsOptional, IsString } from "class-validator";

export class AddressDTO {
    @IsString()
    street: string

    @IsString()
    number: string

    @IsString()
    @IsOptional()
    complement?: string | null

    @IsString()
    district: string

    @IsString()
    city: string

    @IsString()
    zipCode: string
    
    @IsString()
    country: string

    @IsString()
    neighborhood: string
}