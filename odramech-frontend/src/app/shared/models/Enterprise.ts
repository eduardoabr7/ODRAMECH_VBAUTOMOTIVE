import { Address } from "./Address";
import { Establishment } from "./Establishment";

export interface Enterprise {
    logoUrl?: string,
    name: string,
    email: string,
    phone: string,
    cnpj: string,
    address: Address
    establishments?: Establishment[]
}