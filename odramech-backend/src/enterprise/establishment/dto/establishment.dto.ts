import { IsInt, IsOptional, IsString } from "class-validator";

export class EstablishmentDTO {
    @IsInt()
    id: number

    @IsString()
    name: string

    @IsOptional()
    @IsString()
    email: string | null
}