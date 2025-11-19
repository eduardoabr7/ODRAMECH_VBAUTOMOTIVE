export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
  WORKER = 'WORKER',
}

export interface UserCorporation {
    idUser: number,
    idEnterprise: number,
    idEstablishment: number,
    role: Role
}