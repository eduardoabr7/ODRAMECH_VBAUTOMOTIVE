import { IsEmail, IsOptional, IsString } from "class-validator";

export class LoginDTO {
    @IsString()
    @IsOptional()
    username

    @IsEmail({}, { message: "O email informado não é válido" })
    @IsOptional()
    email

    @IsString()
    password
}