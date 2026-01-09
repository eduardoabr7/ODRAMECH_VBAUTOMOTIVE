
import { IsEmail, IsNumber, IsString } from "class-validator"

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
}