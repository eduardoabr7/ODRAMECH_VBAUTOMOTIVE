import { EnterpriseCreate } from "./EnterpriseCreate";
import { Establishment } from "./Establishment";

export interface EnterpriseWithEstablishments {
    enterprise: EnterpriseCreate
    establishment: Establishment[]
}