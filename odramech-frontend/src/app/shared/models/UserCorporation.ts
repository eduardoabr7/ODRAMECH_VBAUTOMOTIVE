import { Establishment } from "./Establishment"

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
  WORKER = 'WORKER',
  SUPERUSER = 'SUPERUSER'
}

export interface UserCorporation {
    idUser: number,
    idEnterprise: number,
    idEstablishment: number,
    role: Role
}