import { Role } from "@prisma/client";
import { AuthContext } from "../enums/auth-context.enum";

export interface AuthPayload {
  sub: number,
  role: Role,
  establishmentId: number,
  enterpriseId: number,
  context: AuthContext,
}