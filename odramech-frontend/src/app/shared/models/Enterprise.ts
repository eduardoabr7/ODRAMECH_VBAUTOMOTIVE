import { Address } from "./Address";

export interface Enterprise {
    logoUrl?: string,
    name: string,
    email: string,
    phone: string,
    cnpj: string,
    address: Address
}