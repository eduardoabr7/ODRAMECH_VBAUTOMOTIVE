import { Address } from "./Address"
import { Establishment } from "./Establishment"

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
  WORKER = 'WORKER',
  SUPERUSER = 'SUPERUSER'
}

interface EstablishmentNormalize {
    id?: number
    logoUrl?: string,
    name: string,
    email: string,
    phone: string,
    cnpj: string,
    address: Address,
    role: Role
}

// export interface UserCorporation {
//     idUser: number,
//     idEnterprise: number,
//     idEstablishment: number,
//     role: Role
// }

export interface UserCorporation {
    establishment: EstablishmentNormalize,
    id: number,
    logoUrl: string,
    name: string,
}