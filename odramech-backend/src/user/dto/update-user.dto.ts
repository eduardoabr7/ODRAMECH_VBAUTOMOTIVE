import { Gender } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";
import { AddressDTO } from "src/address/dto/address.dto";

export class UpdateUserDTO {
    @IsString()
    @IsOptional()
    name?: string;

    @IsEnum(Gender)
    @IsOptional()
    gender?: Gender;

    @IsEmail()
    @IsOptional()
    email?: string | null;

    @IsString()
    @IsOptional()
    principalPhone?: string;

    @IsString()
    @IsOptional()
    secondaryPhone?: string | null;

    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDTO)
    address?: AddressDTO | null;
}
