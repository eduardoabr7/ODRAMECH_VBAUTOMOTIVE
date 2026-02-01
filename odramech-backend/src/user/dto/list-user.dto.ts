import { IsEmail, IsNumber, IsOptional, IsString } from "class-validator";

export class ListUserDto {

    @IsNumber()
    id: number;

    @IsString()
    name: string;

    @IsString()
    @IsEmail()
    email: string;

    @IsString()
    @IsOptional()
    phone?: string;

}