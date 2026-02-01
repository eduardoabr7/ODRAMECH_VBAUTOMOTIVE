import { UserCorporation } from "./UserCorporation";
import { UserLogged } from "./UserLogged";

export interface AuthContext {
    user: UserLogged,
    usercorp: UserCorporation[] | null
}