import { AuthContext } from "../enums/auth-context.enum";

export interface AuthPayload {
  sub: number,
  role: string,
  establishmentId: number,
  enterpriseId: number,
  context: AuthContext,
}