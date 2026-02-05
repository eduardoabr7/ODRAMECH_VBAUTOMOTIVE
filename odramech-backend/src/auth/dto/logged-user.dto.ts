
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString } from "class-validator"
import { AuthContext } from "../enums/auth-context.enum"

export class LoggedUser {
    @IsNumber()
    id: number

    @IsString()
    name: string

    @IsString()
    @IsEmail()
    email: string

    @IsString()
    principalPhone: string

    @IsString()
    @IsOptional()
    secondaryPhone?: string

    @IsEnum(AuthContext)
    context: AuthContext;
}