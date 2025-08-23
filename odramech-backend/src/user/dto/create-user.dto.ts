import { IsEmail, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateUserDto {

    @IsString()
    name: string;

    @IsString()
    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    username: string;

    @IsString()
    password: string;

    @IsString()
    @IsOptional()
    phone?: string;

}