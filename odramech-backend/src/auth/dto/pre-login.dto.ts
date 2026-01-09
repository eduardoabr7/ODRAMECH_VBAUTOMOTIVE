import { IsEmail, IsNumber, IsOptional, IsString, Matches } from "class-validator";

export class PreLoginDTO {
    @IsEmail({}, { message: "O email informado não é válido" })
    @IsOptional()
    email

    @IsString()
    password
}