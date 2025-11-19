import { Address } from "./Address";
import { Enterprise } from "./Enterprise";
import { Establishment } from "./Establishment";

export interface EnterpriseWithEstablishment {
    enterprise: Enterprise
    establishment: Establishment
}