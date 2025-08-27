import { IsEmail, IsOptional, IsString, Matches } from "class-validator";

export class LoginDTO {
    @IsString()
    @Matches(/^[^@]*$/, { message: 'Username não pode conter um e-mail' })
    @IsOptional()
    username

    @IsEmail({}, { message: "O email informado não é válido" })
    @IsOptional()
    email

    @IsString()
    password
}