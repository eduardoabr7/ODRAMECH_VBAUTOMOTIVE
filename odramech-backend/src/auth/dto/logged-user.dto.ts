
import { IsEmail, IsEnum, IsNumber, IsString } from "class-validator"
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
    phone: string

    @IsEnum(AuthContext)
    context: AuthContext;
}