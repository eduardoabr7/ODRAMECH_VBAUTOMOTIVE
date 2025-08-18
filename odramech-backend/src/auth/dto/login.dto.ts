import { IsOptional, IsString } from "class-validator";

export class LoginDTO {
    @IsString()
    @IsOptional()
    username

    @IsString()
    @IsOptional()
    email

    @IsString()
    password
}