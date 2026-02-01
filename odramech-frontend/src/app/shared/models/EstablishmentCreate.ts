import { AddressCreate } from "./AddressCreate";

export interface EstablishmentCreate {
    id?: number
    logoUrl?: string,
    name: string,
    email: string,
    phone: string,
    cnpj: string,
    address: AddressCreate
}