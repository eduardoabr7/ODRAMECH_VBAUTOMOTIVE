
import { IsEmail, IsString } from "class-validator"

export class LoggedUser {
    @IsString()
    name: string

    @IsString()
    username: string

    @IsString()
    @IsEmail()
    email?: string

    @IsString()
    phone: string
}