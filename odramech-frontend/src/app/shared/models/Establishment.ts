import { Address } from "./Address";

export interface Establishment {
    id?: number
    logoUrl?: string,
    name: string,
    email: string,
    phone: string,
    cnpj: string,
    address: Address
}