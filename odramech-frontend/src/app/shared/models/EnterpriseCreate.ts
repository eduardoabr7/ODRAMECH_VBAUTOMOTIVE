import { Address } from "cluster"
import { Establishment } from "./Establishment"
import { AddressCreate } from "./AddressCreate"

export interface EnterpriseCreate {
    id?: number,
    logoUrl?: string,
    name: string,
    email: string,
    phone: string,
    cnpj: string,
    address: AddressCreate
    establishments?: Establishment[]
}