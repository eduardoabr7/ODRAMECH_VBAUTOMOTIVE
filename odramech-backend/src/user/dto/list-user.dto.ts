import { IsEmail, IsNumber, IsOptional, IsString } from "class-validator";

export class ListUserDto {

    @IsNumber()
    id: number;

    @IsString()
    name: string;

    @IsString()
    @IsEmail()
    @IsOptional()
    email: string | null;

    @IsString()
    @IsOptional()
    principalPhone: string | null;

}