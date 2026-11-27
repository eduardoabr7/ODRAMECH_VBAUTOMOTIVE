import { IsBoolean, IsEmail, IsInt, IsNumber, IsOptional, IsString } from "class-validator";
import { AddressDTO } from "src/address/dto/address.dto";
import { Gender } from '@prisma/client';
export class CreateUserDto {

    @IsString()
    name: string

    @IsString()
    gender: Gender

    @IsString()
    @IsEmail()
    @IsOptional()
    email?: string | null

    @IsString()
    @IsOptional()
    password?: string | null

    @IsString()
    principalPhone: string;

    @IsString()
    @IsOptional()
    secondaryPhone?: string | null

    @IsOptional()
    address?: AddressDTO | null

    @IsNumber()
    establishmentId: number

    @IsNumber()
    enterpriseId: number
}

export class FrontEndCreateUser {

    @IsString()
    name: string

    @IsString()
    gender: Gender

    @IsString()
    @IsEmail()
    @IsOptional()
    email?: string | null

    @IsString()
    @IsOptional()
    password?: string | null

    @IsString()
    principalPhone: string;

    @IsString()
    @IsOptional()
    secondaryPhone?: string | null

    @IsOptional()
    address?: AddressDTO | null

    /** desmarcado = cadastrado, mas sem acesso a este estabelecimento */
    @IsOptional()
    @IsBoolean()
    active?: boolean

    /** estabelecimento escolhido na tela de clientes (padrão: o da sessão) */
    @IsOptional()
    @IsInt()
    establishmentId?: number

}