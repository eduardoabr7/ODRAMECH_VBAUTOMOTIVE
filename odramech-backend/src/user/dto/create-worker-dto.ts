import { Gender, Role } from "@prisma/client";
import { IsEmail, IsOptional, IsString } from "class-validator";
import { AddressDTO } from "src/address/dto/address.dto";

export class CreateWorkerDTO {
    @IsString()
    name: string

    @IsString()
    gender: Gender

    @IsString()
    @IsEmail()
    @IsOptional()
    email: string

    @IsString()
    @IsOptional()
    password: string

    @IsString()
    principalPhone: string;

    @IsString()
    @IsOptional()
    secondaryPhone?: string | null

    @IsOptional()
    address?: AddressDTO | null

    @IsOptional()
    role: Role
}