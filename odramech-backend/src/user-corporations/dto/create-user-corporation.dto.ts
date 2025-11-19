import { IsEnum, IsNumber } from "class-validator";
import { Role } from "./role.enum";

export class createUserCorporationDTO {
    @IsNumber()
    idUser: number

    @IsNumber()
    idEnterprise: number

    @IsNumber()
    idEstablishment: number

    @IsEnum(Role)
    role: Role
}