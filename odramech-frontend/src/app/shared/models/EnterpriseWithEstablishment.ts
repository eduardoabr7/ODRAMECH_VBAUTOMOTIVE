import { Address } from "./Address";
import { Enterprise } from "./Enterprise";
import { Establishment } from "./Establishment";

export interface EnterpriseWithEstablishments {
    enterprise: Enterprise
    establishment: Establishment[]
}